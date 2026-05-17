import { Router, type IRouter } from "express";
import { eq, sql, and, gte } from "drizzle-orm";
import { db, generatedIdsTable } from "@workspace/db";
import {
  ListIdsQueryParams,
  ListIdsResponse,
  GetIdStatsResponse,
  DeleteIdParams,
  DeleteIdResponse,
  RetryIdParams,
  RetryIdResponse,
  ExportIdsQueryParams,
  ExportIdsResponse,
} from "@workspace/api-zod";
import { generateCredentials } from "../lib/generator";

const router: IRouter = Router();

router.get("/ids", async (req, res): Promise<void> => {
  const query = ListIdsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { status, page, limit } = query.data;
  const offset = ((page ?? 1) - 1) * (limit ?? 50);

  const conditions = status ? [eq(generatedIdsTable.status, status)] : [];

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(generatedIdsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(sql`${generatedIdsTable.createdAt} DESC`)
      .limit(limit ?? 50)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(generatedIdsTable)
      .where(conditions.length ? and(...conditions) : undefined),
  ]);

  const total = totalRows[0]?.count ?? 0;

  res.json(
    ListIdsResponse.parse({
      data: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
      page: page ?? 1,
      limit: limit ?? 50,
    })
  );
});

router.get("/ids/stats", async (_req, res): Promise<void> => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [allStats, todayStats] = await Promise.all([
    db
      .select({
        status: generatedIdsTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(generatedIdsTable)
      .groupBy(generatedIdsTable.status),
    db
      .select({
        status: generatedIdsTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(generatedIdsTable)
      .where(gte(generatedIdsTable.createdAt, todayStart))
      .groupBy(generatedIdsTable.status),
  ]);

  const getCount = (arr: { status: string; count: number }[], s: string) =>
    arr.find((x) => x.status === s)?.count ?? 0;

  const successCount = getCount(allStats, "success");
  const failedCount = getCount(allStats, "failed");
  const pendingCount = getCount(allStats, "pending");
  const total = successCount + failedCount + pendingCount;
  const todaySuccess = getCount(todayStats, "success");
  const todayFailed = getCount(todayStats, "failed");
  const todayTotal = todaySuccess + todayFailed + getCount(todayStats, "pending");
  const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;

  res.json(
    GetIdStatsResponse.parse({
      total,
      todayTotal,
      successCount,
      failedCount,
      pendingCount,
      successRate,
      todaySuccess,
      todayFailed,
    })
  );
});

router.get("/ids/export", async (req, res): Promise<void> => {
  const query = ExportIdsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { status, format } = query.data;
  const conditions =
    status && status !== "all" ? [eq(generatedIdsTable.status, status)] : [];

  const rows = await db
    .select()
    .from(generatedIdsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${generatedIdsTable.createdAt} DESC`);

  let data: string;
  if (format === "txt") {
    data = rows
      .map((r) => `${r.email}:${r.username}:${r.password}`)
      .join("\n");
  } else {
    const header = "email,username,password,recovery_email,status,created_at";
    const lines = rows.map(
      (r) =>
        `${r.email},${r.username},${r.password},${r.recoveryEmail ?? ""},${r.status},${r.createdAt.toISOString()}`
    );
    data = [header, ...lines].join("\n");
  }

  res.json(
    ExportIdsResponse.parse({
      data,
      count: rows.length,
      format: format ?? "csv",
    })
  );
});

router.delete("/ids/:id", async (req, res): Promise<void> => {
  const params = DeleteIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(generatedIdsTable)
    .where(eq(generatedIdsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "ID not found" });
    return;
  }

  res.json(DeleteIdResponse.parse({ success: true }));
});

router.post("/ids/:id/retry", async (req, res): Promise<void> => {
  const params = RetryIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(generatedIdsTable)
    .where(eq(generatedIdsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "ID not found" });
    return;
  }

  const { email, username, password } = generateCredentials("user", "gmail.com");
  const [updated] = await db
    .update(generatedIdsTable)
    .set({ status: "success", email, username, password, errorMessage: null })
    .where(eq(generatedIdsTable.id, params.data.id))
    .returning();

  res.json(
    RetryIdResponse.parse({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
    })
  );
});

export default router;
