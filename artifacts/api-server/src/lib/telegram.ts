import TelegramBot from "node-telegram-bot-api";
import { eq, sql, gte, desc } from "drizzle-orm";
import { db, generatedIdsTable, batchesTable, settingsTable, proxiesTable } from "@workspace/db";
import { generateCredentials, generateTempMailCredentials } from "./generator";
import { logger } from "./logger";

let bot: TelegramBot | null = null;

// ── helpers ────────────────────────────────────────────────────────────────

function escape(text: string | number): string {
  return String(text).replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

async function getStats() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [allStats, todayStats] = await Promise.all([
    db
      .select({ status: generatedIdsTable.status, count: sql<number>`count(*)::int` })
      .from(generatedIdsTable)
      .groupBy(generatedIdsTable.status),
    db
      .select({ status: generatedIdsTable.status, count: sql<number>`count(*)::int` })
      .from(generatedIdsTable)
      .where(gte(generatedIdsTable.createdAt, todayStart))
      .groupBy(generatedIdsTable.status),
  ]);

  const get = (arr: { status: string; count: number }[], s: string) =>
    arr.find((x) => x.status === s)?.count ?? 0;

  const success = get(allStats, "success");
  const failed = get(allStats, "failed");
  const total = success + failed + get(allStats, "pending");
  const todaySuccess = get(todayStats, "success");
  const todayFailed = get(todayStats, "failed");
  const rate = total > 0 ? Math.round((success / total) * 100) : 0;

  return { total, success, failed, rate, todaySuccess, todayFailed };
}

async function getSettings() {
  const [s] = await db.select().from(settingsTable).limit(1);
  return s ?? null;
}

async function runBatch(targetCount: number, batchName: string) {
  const settings = await getSettings();
  const useTempEmail = settings?.useTempEmail ?? false;
  const usernamePrefix = settings?.usernamePrefix ?? "user";
  const emailDomain = settings?.emailDomain ?? "gmail.com";

  const [batch] = await db
    .insert(batchesTable)
    .values({ name: batchName, targetCount, status: "running", successCount: 0, failCount: 0, progress: 0 })
    .returning();

  const ids: { email: string; username: string; password: string; status: string; errorMessage?: string; batchId: number }[] = [];
  let successCount = 0;
  let failCount = 0;

  if (useTempEmail) {
    const CONCURRENCY = 5;
    for (let i = 0; i < targetCount; i += CONCURRENCY) {
      const chunk = Math.min(CONCURRENCY, targetCount - i);
      const results = await Promise.allSettled(
        Array.from({ length: chunk }, () => generateTempMailCredentials(usernamePrefix))
      );
      for (const r of results) {
        if (r.status === "fulfilled") {
          ids.push({ ...r.value, status: "success", batchId: batch.id });
          successCount++;
        } else {
          ids.push({ email: `failed@temp.invalid`, username: "failed", password: "N/A", status: "failed", errorMessage: "Temp mail failed", batchId: batch.id });
          failCount++;
        }
      }
      if (i + CONCURRENCY < targetCount) await new Promise((r) => setTimeout(r, 200));
    }
  } else {
    for (let i = 0; i < targetCount; i++) {
      if (Math.random() < 0.05) {
        ids.push({ email: `failed_${Date.now()}_${i}@x.com`, username: `failed_${i}`, password: "N/A", status: "failed", errorMessage: "Timeout", batchId: batch.id });
        failCount++;
      } else {
        const creds = generateCredentials(usernamePrefix, emailDomain);
        ids.push({ ...creds, status: "success", batchId: batch.id });
        successCount++;
      }
    }
  }

  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    await db.insert(generatedIdsTable).values(ids.slice(i, i + CHUNK));
  }

  const [updated] = await db
    .update(batchesTable)
    .set({ status: "completed", successCount, failCount, progress: 100, completedAt: new Date() })
    .where(eq(batchesTable.id, batch.id))
    .returning();

  return { batch: updated, successCount, failCount };
}

// ── command handlers ───────────────────────────────────────────────────────

async function cmdStart(chatId: number) {
  const msg = `*ID Creator Bot* 🤖

Aapka bot ready hai\\! Neeche commands use karein:

/stats \\- Aaj ke aur total stats dekhein
/generate \\<count\\> \\- IDs generate karein \\(e\\.g\\. /generate 50\\)
/batches \\- Recent batches ki list
/export \\- Last 20 successful IDs export karein
/settings \\- Bot settings dekhein
/proxies \\- Active proxies dekhein
/help \\- Sab commands dekhein`;
  await bot!.sendMessage(chatId, msg, { parse_mode: "MarkdownV2" });
}

async function cmdHelp(chatId: number) {
  const msg = `*Available Commands*

📊 /stats \\- Total aur aaj ke stats
⚙️ /settings \\- Current configuration
🚀 /generate \\<count\\> \\- Naya batch shuru karein
📋 /batches \\- Recent 5 batches
📤 /export \\- Last 20 IDs copy karein
🌐 /proxies \\- Proxy list dekhein
❓ /help \\- Yeh message

*Example:*
\`/generate 100\` \\- 100 IDs banao`;
  await bot!.sendMessage(chatId, msg, { parse_mode: "MarkdownV2" });
}

async function cmdStats(chatId: number) {
  await bot!.sendMessage(chatId, "📊 Stats la raha hoon...");
  const s = await getStats();
  const msg = `*Current Stats*

👥 *Total IDs:* ${escape(s.total)}
✅ *Success:* ${escape(s.success)}
❌ *Failed:* ${escape(s.failed)}
📈 *Success Rate:* ${escape(s.rate)}%

*Aaj ka:*
✅ Today Success: ${escape(s.todaySuccess)}
❌ Today Failed: ${escape(s.todayFailed)}
📅 Today Total: ${escape(s.todaySuccess + s.todayFailed)}`;
  await bot!.sendMessage(chatId, msg, { parse_mode: "MarkdownV2" });
}

async function cmdGenerate(chatId: number, countArg?: string) {
  const count = parseInt(countArg ?? "10", 10);
  if (isNaN(count) || count < 1 || count > 5000) {
    await bot!.sendMessage(chatId, "❌ Count galat hai\\. 1 se 5000 ke beech number dein\\.\n\nExample: `/generate 50`", { parse_mode: "MarkdownV2" });
    return;
  }

  const settings = await getSettings();
  const mode = settings?.useTempEmail ? "Temp Mail \\(mail\\.tm\\)" : escape(`Custom (${settings?.emailDomain ?? "gmail.com"})`);

  await bot!.sendMessage(chatId, `🚀 *${escape(count)} IDs generate ho rahi hain\\.\\.\\.*\n\nMode: ${mode}\n\n_Thodi der wait karein\\.\\.\\._`, { parse_mode: "MarkdownV2" });

  try {
    const batchName = `Telegram Batch - ${new Date().toLocaleString()}`;
    const result = await runBatch(count, batchName);

    const msg = `✅ *Generation Complete\\!*

📦 Batch: ${escape(result.batch.name)}
🎯 Target: ${escape(count)}
✅ Success: ${escape(result.successCount)}
❌ Failed: ${escape(result.failCount)}
📈 Rate: ${escape(Math.round((result.successCount / count) * 100))}%

Use /export to get the IDs\\.`;
    await bot!.sendMessage(chatId, msg, { parse_mode: "MarkdownV2" });
  } catch (err) {
    logger.error({ err }, "Telegram generate error");
    await bot!.sendMessage(chatId, "❌ Generation mein error aaya\\. Please dobara try karein\\.", { parse_mode: "MarkdownV2" });
  }
}

async function cmdBatches(chatId: number) {
  const rows = await db
    .select()
    .from(batchesTable)
    .orderBy(desc(batchesTable.createdAt))
    .limit(5);

  if (rows.length === 0) {
    await bot!.sendMessage(chatId, "📋 Abhi koi batch nahi hai\\. `/generate 50` se shuru karein\\.", { parse_mode: "MarkdownV2" });
    return;
  }

  const statusIcon = (s: string) => ({ completed: "✅", running: "🔄", failed: "❌", pending: "⏳" }[s] ?? "❓");

  const lines = rows.map((b) => {
    const rate = b.targetCount > 0 ? Math.round((b.successCount / b.targetCount) * 100) : 0;
    return `${statusIcon(b.status)} *${escape(b.name)}*\n   Target: ${escape(b.targetCount)} | Success: ${escape(b.successCount)} | Rate: ${escape(rate)}%`;
  });

  const msg = `*Recent Batches*\n\n${lines.join("\n\n")}`;
  await bot!.sendMessage(chatId, msg, { parse_mode: "MarkdownV2" });
}

async function cmdExport(chatId: number) {
  const rows = await db
    .select()
    .from(generatedIdsTable)
    .where(eq(generatedIdsTable.status, "success"))
    .orderBy(desc(generatedIdsTable.createdAt))
    .limit(20);

  if (rows.length === 0) {
    await bot!.sendMessage(chatId, "📤 Export ke liye koi successful ID nahi hai\\. Pehle `/generate` karein\\.", { parse_mode: "MarkdownV2" });
    return;
  }

  const lines = rows.map((r) => `${r.email}:${r.username}:${r.password}`).join("\n");
  const fileContent = Buffer.from(lines, "utf-8");

  await bot!.sendMessage(chatId, `📤 Last *${escape(rows.length)}* IDs export kar raha hoon\\.`, { parse_mode: "MarkdownV2" });
  await bot!.sendDocument(
    chatId,
    fileContent,
    { caption: `✅ ${rows.length} IDs exported\nFormat: email:username:password` },
    { filename: `ids_export_${Date.now()}.txt`, contentType: "text/plain" }
  );
}

async function cmdSettings(chatId: number) {
  const s = await getSettings();
  if (!s) {
    await bot!.sendMessage(chatId, "⚙️ Settings nahi mili\\. Dashboard se configure karein\\.", { parse_mode: "MarkdownV2" });
    return;
  }

  const msg = `*Current Settings*

🎯 Daily Target: ${escape(s.dailyTarget)}
⏰ Schedule: ${escape(s.scheduleTime)}
📧 Email Mode: ${s.useTempEmail ? "Temp Mail \\(mail\\.tm\\)" : escape(`Custom (${s.emailDomain})`)}
👤 Username Prefix: ${escape(s.usernamePrefix)}
🌐 Proxy: ${s.proxyEnabled ? "ON" : "OFF"}
🔄 Auto Retry: ${s.retryEnabled ? `ON \\(max ${escape(s.retryMax)}\\)` : "OFF"}
⚡ Bot Active: ${s.isActive ? "YES" : "NO"}

_Settings badlne ke liye dashboard use karein_`;
  await bot!.sendMessage(chatId, msg, { parse_mode: "MarkdownV2" });
}

async function cmdProxies(chatId: number) {
  const rows = await db.select().from(proxiesTable).orderBy(proxiesTable.createdAt);

  if (rows.length === 0) {
    await bot!.sendMessage(chatId, "🌐 Koi proxy nahi hai\\. Dashboard se proxies add karein\\.", { parse_mode: "MarkdownV2" });
    return;
  }

  const statusIcon = (s: string) => ({ active: "🟢", inactive: "🔴", failed: "⚠️" }[s] ?? "❓");
  const lines = rows.map((p) => `${statusIcon(p.status)} ${escape(p.host)}:${escape(p.port)} \\(${escape(p.status)}\\)`);

  const msg = `*Proxy List* \\(${escape(rows.length)} total\\)\n\n${lines.join("\n")}`;
  await bot!.sendMessage(chatId, msg, { parse_mode: "MarkdownV2" });
}

// ── bot startup ────────────────────────────────────────────────────────────

export function startTelegramBot(): void {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled");
    return;
  }

  try {
    bot = new TelegramBot(token, { polling: true });

    bot.onText(/\/start/, (msg) => cmdStart(msg.chat.id).catch((e) => logger.error({ e }, "cmd start error")));
    bot.onText(/\/help/, (msg) => cmdHelp(msg.chat.id).catch((e) => logger.error({ e }, "cmd help error")));
    bot.onText(/\/stats/, (msg) => cmdStats(msg.chat.id).catch((e) => logger.error({ e }, "cmd stats error")));
    bot.onText(/\/generate(?:\s+(\d+))?/, (msg, match) => cmdGenerate(msg.chat.id, match?.[1]).catch((e) => logger.error({ e }, "cmd generate error")));
    bot.onText(/\/batches/, (msg) => cmdBatches(msg.chat.id).catch((e) => logger.error({ e }, "cmd batches error")));
    bot.onText(/\/export/, (msg) => cmdExport(msg.chat.id).catch((e) => logger.error({ e }, "cmd export error")));
    bot.onText(/\/settings/, (msg) => cmdSettings(msg.chat.id).catch((e) => logger.error({ e }, "cmd settings error")));
    bot.onText(/\/proxies/, (msg) => cmdProxies(msg.chat.id).catch((e) => logger.error({ e }, "cmd proxies error")));

    bot.on("polling_error", (err) => logger.error({ err }, "Telegram polling error"));

    logger.info("Telegram bot started successfully");
  } catch (err) {
    logger.error({ err }, "Failed to start Telegram bot");
  }
}

export function stopTelegramBot(): void {
  if (bot) {
    bot.stopPolling();
    bot = null;
    logger.info("Telegram bot stopped");
  }
}
