import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, batchesTable, generatedIdsTable, settingsTable } from "@workspace/db";
import {
  ListBatchesResponse,
  CreateBatchBody,
  GetBatchParams,
  GetBatchResponse,
} from "@workspace/api-zod";
import { generateCredentials, generateTempMailCredentials } from "../lib/generator";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/batches", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(batchesTable)
    .orderBy(batchesTable.createdAt);

  res.json(
    ListBatchesResponse.parse(
      rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        completedAt: r.completedAt ? r.completedAt.toISOString() : null,
      }))
    )
  );
});

router.post("/batches", async (req, res): Promise<void> => {
  const parsed = CreateBatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { targetCount, name } = parsed.data;
  const batchName = name ?? `Batch ${new Date().toLocaleString()}`;

  // Read current settings
  const [settings] = await db.select().from(settingsTable).limit(1);
  const useTempEmail = settings?.useTempEmail ?? false;
  const usernamePrefix = settings?.usernamePrefix ?? "user";
  const emailDomain = settings?.emailDomain ?? "gmail.com";

  const [batch] = await db
    .insert(batchesTable)
    .values({
      name: batchName,
      targetCount,
      status: "running",
      successCount: 0,
      failCount: 0,
      progress: 0,
    })
    .returning();

  const ids: {
    email: string;
    username: string;
    password: string;
    status: string;
    errorMessage?: string;
    batchId: number;
  }[] = [];
  let successCount = 0;
  let failCount = 0;

  if (useTempEmail) {
    // Real temp mail: create accounts concurrently in batches of 5 to avoid rate limits
    logger.info({ targetCount, batchId: batch.id }, "Generating temp mail accounts");
    const CONCURRENCY = 5;
    for (let i = 0; i < targetCount; i += CONCURRENCY) {
      const chunk = Math.min(CONCURRENCY, targetCount - i);
      const results = await Promise.allSettled(
        Array.from({ length: chunk }, () => generateTempMailCredentials(usernamePrefix))
      );
      for (const result of results) {
        if (result.status === "fulfilled") {
          ids.push({
            email: result.value.email,
            username: result.value.username,
            password: result.value.password,
            status: "success",
            batchId: batch.id,
          });
          successCount++;
        } else {
          ids.push({
            email: `failed_${Date.now()}@temp.invalid`,
            username: `failed_user`,
            password: "N/A",
            status: "failed",
            errorMessage: "Temp mail creation failed",
            batchId: batch.id,
          });
          failCount++;
        }
      }
      // Small delay between chunks to avoid rate limiting
      if (i + CONCURRENCY < targetCount) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
  } else {
    // Fast local generation
    for (let i = 0; i < targetCount; i++) {
      const shouldFail = Math.random() < 0.05;
      if (shouldFail) {
        ids.push({
          email: `failed_${Date.now()}_${i}@example.com`,
          username: `failed_user_${i}`,
          password: "N/A",
          status: "failed",
          errorMessage: "Connection timeout",
          batchId: batch.id,
        });
        failCount++;
      } else {
        const creds = generateCredentials(usernamePrefix, emailDomain);
        ids.push({ ...creds, status: "success", batchId: batch.id });
        successCount++;
      }
    }
  }

  if (ids.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < ids.length; i += chunkSize) {
      await db.insert(generatedIdsTable).values(ids.slice(i, i + chunkSize));
    }
  }

  const [updated] = await db
    .update(batchesTable)
    .set({
      status: "completed",
      successCount,
      failCount,
      progress: 100,
      completedAt: new Date(),
    })
    .where(eq(batchesTable.id, batch.id))
    .returning();

  res.status(201).json(
    GetBatchResponse.parse({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
    })
  );
});

router.get("/batches/:id", async (req, res): Promise<void> => {
  const params = GetBatchParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [batch] = await db
    .select()
    .from(batchesTable)
    .where(eq(batchesTable.id, params.data.id));

  if (!batch) {
    res.status(404).json({ error: "Batch not found" });
    return;
  }

  res.json(
    GetBatchResponse.parse({
      ...batch,
      createdAt: batch.createdAt.toISOString(),
      completedAt: batch.completedAt ? batch.completedAt.toISOString() : null,
    })
  );
});

export default router;
