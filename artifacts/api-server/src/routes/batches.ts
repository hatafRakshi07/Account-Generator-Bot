import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, batchesTable, generatedIdsTable } from "@workspace/db";
import {
  ListBatchesResponse,
  CreateBatchBody,
  GetBatchParams,
  GetBatchResponse,
} from "@workspace/api-zod";
import { generateCredentials } from "../lib/generator";

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

  // Simulate generation (create IDs immediately)
  const ids = [];
  let successCount = 0;
  let failCount = 0;
  for (let i = 0; i < targetCount; i++) {
    const shouldFail = Math.random() < 0.05; // 5% failure rate
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
      const { email, username, password } = generateCredentials("user", "gmail.com");
      ids.push({
        email,
        username,
        password,
        status: "success",
        batchId: batch.id,
      });
      successCount++;
    }
  }

  if (ids.length > 0) {
    // Insert in chunks of 100
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
