import TelegramBot from "node-telegram-bot-api";
import { eq, sql, gte, desc } from "drizzle-orm";
import { db, generatedIdsTable, batchesTable, settingsTable, proxiesTable } from "@workspace/db";
import { generateCredentials, generateTempMailCredentials } from "./generator";
import { logger } from "./logger";

let bot: TelegramBot | null = null;

// ── helpers ────────────────────────────────────────────────────────────────

async function send(chatId: number, text: string) {
  await bot!.sendMessage(chatId, text);
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
  await send(chatId,
    "ID Creator Bot - Ready!\n\n" +
    "Commands:\n" +
    "/stats - Stats dekhein\n" +
    "/generate 50 - 50 IDs banao\n" +
    "/batches - Recent batches\n" +
    "/export - Last 20 IDs download karein\n" +
    "/settings - Bot settings\n" +
    "/proxies - Proxy list\n" +
    "/help - Sab commands"
  );
}

async function cmdHelp(chatId: number) {
  await send(chatId,
    "Available Commands:\n\n" +
    "/start - Welcome message\n" +
    "/stats - Total aur aaj ke stats\n" +
    "/generate <count> - Naya batch shuru karein\n" +
    "  Example: /generate 100\n" +
    "/batches - Recent 5 batches ki list\n" +
    "/export - Last 20 successful IDs .txt file mein\n" +
    "/settings - Current configuration\n" +
    "/proxies - Proxy list\n" +
    "/help - Yeh message"
  );
}

async function cmdStats(chatId: number) {
  await send(chatId, "Stats la raha hoon...");
  const s = await getStats();
  await send(chatId,
    "=== Current Stats ===\n\n" +
    `Total IDs: ${s.total}\n` +
    `Success: ${s.success}\n` +
    `Failed: ${s.failed}\n` +
    `Success Rate: ${s.rate}%\n\n` +
    "=== Aaj Ka ===\n" +
    `Today Success: ${s.todaySuccess}\n` +
    `Today Failed: ${s.todayFailed}\n` +
    `Today Total: ${s.todaySuccess + s.todayFailed}`
  );
}

async function cmdGenerate(chatId: number, countArg?: string) {
  const count = parseInt(countArg ?? "10", 10);
  if (isNaN(count) || count < 1 || count > 5000) {
    await send(chatId, "Count galat hai. 1 se 5000 ke beech number dein.\n\nExample: /generate 50");
    return;
  }

  const settings = await getSettings();
  const mode = settings?.useTempEmail
    ? "Temp Mail (mail.tm)"
    : `Custom Domain (${settings?.emailDomain ?? "gmail.com"})`;

  await send(chatId, `${count} IDs generate ho rahi hain...\nMode: ${mode}\n\nThodi der wait karein...`);

  try {
    const batchName = `Telegram Batch - ${new Date().toLocaleString()}`;
    const result = await runBatch(count, batchName);
    const rate = Math.round((result.successCount / count) * 100);

    await send(chatId,
      "=== Generation Complete! ===\n\n" +
      `Target: ${count}\n` +
      `Success: ${result.successCount}\n` +
      `Failed: ${result.failCount}\n` +
      `Rate: ${rate}%\n\n` +
      "IDs pane ke liye /export karein."
    );
  } catch (err) {
    logger.error({ err }, "Telegram generate error");
    await send(chatId, "Generation mein error aaya. Please dobara try karein.");
  }
}

async function cmdBatches(chatId: number) {
  const rows = await db
    .select()
    .from(batchesTable)
    .orderBy(desc(batchesTable.createdAt))
    .limit(5);

  if (rows.length === 0) {
    await send(chatId, "Abhi koi batch nahi hai. /generate 50 se shuru karein.");
    return;
  }

  const statusIcon = (s: string) =>
    ({ completed: "[DONE]", running: "[RUNNING]", failed: "[FAILED]", pending: "[PENDING]" }[s] ?? "[?]");

  const lines = rows.map((b) => {
    const rate = b.targetCount > 0 ? Math.round((b.successCount / b.targetCount) * 100) : 0;
    return `${statusIcon(b.status)} ${b.name}\nTarget: ${b.targetCount} | Success: ${b.successCount} | Rate: ${rate}%`;
  });

  await send(chatId, "=== Recent Batches ===\n\n" + lines.join("\n\n"));
}

async function cmdExport(chatId: number) {
  const rows = await db
    .select()
    .from(generatedIdsTable)
    .where(eq(generatedIdsTable.status, "success"))
    .orderBy(desc(generatedIdsTable.createdAt))
    .limit(20);

  if (rows.length === 0) {
    await send(chatId, "Export ke liye koi successful ID nahi hai. Pehle /generate karein.");
    return;
  }

  const lines = rows.map((r) => `${r.email}:${r.username}:${r.password}`).join("\n");
  const fileContent = Buffer.from(lines, "utf-8");

  await send(chatId, `Last ${rows.length} IDs export ho rahi hain...`);
  await bot!.sendDocument(
    chatId,
    fileContent,
    { caption: `${rows.length} IDs exported\nFormat: email:username:password` },
    { filename: `ids_export_${Date.now()}.txt`, contentType: "text/plain" }
  );
}

async function cmdSettings(chatId: number) {
  const s = await getSettings();
  if (!s) {
    await send(chatId, "Settings nahi mili. Dashboard se configure karein.");
    return;
  }

  await send(chatId,
    "=== Current Settings ===\n\n" +
    `Daily Target: ${s.dailyTarget}\n` +
    `Schedule: ${s.scheduleTime}\n` +
    `Email Mode: ${s.useTempEmail ? "Temp Mail (mail.tm)" : `Custom (${s.emailDomain})`}\n` +
    `Username Prefix: ${s.usernamePrefix}\n` +
    `Proxy: ${s.proxyEnabled ? "ON" : "OFF"}\n` +
    `Auto Retry: ${s.retryEnabled ? `ON (max ${s.retryMax})` : "OFF"}\n` +
    `Bot Active: ${s.isActive ? "YES" : "NO"}\n\n` +
    "Settings badlne ke liye dashboard use karein."
  );
}

async function cmdProxies(chatId: number) {
  const rows = await db.select().from(proxiesTable).orderBy(proxiesTable.createdAt);

  if (rows.length === 0) {
    await send(chatId, "Koi proxy nahi hai. Dashboard se proxies add karein.");
    return;
  }

  const statusIcon = (s: string) =>
    ({ active: "[ON]", inactive: "[OFF]", failed: "[ERR]" }[s] ?? "[?]");

  const lines = rows.map((p) => `${statusIcon(p.status)} ${p.host}:${p.port} (${p.status})`);
  await send(chatId, `=== Proxy List (${rows.length} total) ===\n\n` + lines.join("\n"));
}

// ── bot startup ────────────────────────────────────────────────────────────

export function startTelegramBot(): void {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — Telegram bot disabled");
    return;
  }

  try {
    bot = new TelegramBot(token, {
      polling: {
        interval: 1000,
        autoStart: true,
        params: { timeout: 10 },
      },
    });

    // Log every incoming message for debugging
    bot.on("message", (msg) => {
      logger.info({ chatId: msg.chat.id, text: msg.text }, "Telegram message received");
    });

    bot.onText(/\/start/, (msg) => {
      logger.info({ chatId: msg.chat.id }, "Handling /start");
      cmdStart(msg.chat.id).catch((e) => logger.error({ e }, "cmd start error"));
    });

    bot.onText(/\/help/, (msg) => {
      cmdHelp(msg.chat.id).catch((e) => logger.error({ e }, "cmd help error"));
    });

    bot.onText(/\/stats/, (msg) => {
      cmdStats(msg.chat.id).catch((e) => logger.error({ e }, "cmd stats error"));
    });

    bot.onText(/\/generate(?:\s+(\d+))?/, (msg, match) => {
      cmdGenerate(msg.chat.id, match?.[1]).catch((e) => logger.error({ e }, "cmd generate error"));
    });

    bot.onText(/\/batches/, (msg) => {
      cmdBatches(msg.chat.id).catch((e) => logger.error({ e }, "cmd batches error"));
    });

    bot.onText(/\/export/, (msg) => {
      cmdExport(msg.chat.id).catch((e) => logger.error({ e }, "cmd export error"));
    });

    bot.onText(/\/settings/, (msg) => {
      cmdSettings(msg.chat.id).catch((e) => logger.error({ e }, "cmd settings error"));
    });

    bot.onText(/\/proxies/, (msg) => {
      cmdProxies(msg.chat.id).catch((e) => logger.error({ e }, "cmd proxies error"));
    });

    bot.on("polling_error", (err) => {
      logger.error({ err: err.message }, "Telegram polling error");
    });

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
