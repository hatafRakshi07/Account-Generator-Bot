import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, proxiesTable } from "@workspace/db";
import {
  ListProxiesResponse,
  AddProxyBody,
  DeleteProxyParams,
  DeleteProxyResponse,
  ToggleProxyParams,
  ToggleProxyBody,
  ToggleProxyResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const serializeProxy = (p: typeof proxiesTable.$inferSelect) => ({
  ...p,
  createdAt: p.createdAt.toISOString(),
  lastUsed: p.lastUsed ? p.lastUsed.toISOString() : null,
});

router.get("/proxies", async (_req, res): Promise<void> => {
  const rows = await db.select().from(proxiesTable).orderBy(proxiesTable.createdAt);
  res.json(ListProxiesResponse.parse(rows.map(serializeProxy)));
});

router.post("/proxies", async (req, res): Promise<void> => {
  const parsed = AddProxyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [proxy] = await db
    .insert(proxiesTable)
    .values({
      host: parsed.data.host,
      port: parsed.data.port,
      username: parsed.data.username ?? null,
      password: parsed.data.password ?? null,
      isActive: true,
      status: "active",
    })
    .returning();

  res.status(201).json(serializeProxy(proxy));
});

router.delete("/proxies/:id", async (req, res): Promise<void> => {
  const params = DeleteProxyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(proxiesTable)
    .where(eq(proxiesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Proxy not found" });
    return;
  }

  res.json(DeleteProxyResponse.parse({ success: true }));
});

router.patch("/proxies/:id", async (req, res): Promise<void> => {
  const params = ToggleProxyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = ToggleProxyBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const newStatus = body.data.isActive ? "active" : "inactive";

  const [updated] = await db
    .update(proxiesTable)
    .set({ isActive: body.data.isActive, status: newStatus })
    .where(eq(proxiesTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Proxy not found" });
    return;
  }

  res.json(ToggleProxyResponse.parse(serializeProxy(updated)));
});

export default router;
