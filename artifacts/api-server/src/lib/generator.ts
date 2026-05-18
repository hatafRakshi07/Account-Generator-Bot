import crypto from "crypto";

const adjectives = ["swift", "bold", "calm", "dark", "fast", "keen", "pure", "slim", "warm", "wild", "cool", "epic", "iron", "jade", "lime"];
const nouns = ["wolf", "hawk", "bear", "lion", "fox", "oak", "sky", "star", "ray", "gem", "arc", "byte", "core", "data", "node"];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePassword(length = 14): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$";
  let pass = "";
  for (let i = 0; i < length; i++) {
    pass += chars[Math.floor(Math.random() * chars.length)];
  }
  return pass;
}

export function generateCredentials(prefix: string, domain: string) {
  const adj = randomItem(adjectives);
  const noun = randomItem(nouns);
  const num = randomNumber(100, 9999);
  const hash = crypto.randomBytes(3).toString("hex");

  const username = `${prefix}_${adj}${noun}${num}`;
  const email = `${username}.${hash}@${domain}`;
  const password = generatePassword(14);

  return { email, username, password };
}

// Cached available domains from mail.tm
let cachedDomains: string[] = [];
let domainsFetchedAt = 0;

async function getTempMailDomains(): Promise<string[]> {
  const now = Date.now();
  if (cachedDomains.length > 0 && now - domainsFetchedAt < 5 * 60 * 1000) {
    return cachedDomains;
  }
  try {
    const res = await fetch("https://api.mail.tm/domains?page=1", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`domains fetch failed: ${res.status}`);
    const json = (await res.json()) as { "hydra:member": { domain: string; isActive: boolean }[] };
    const domains = json["hydra:member"]
      .filter((d) => d.isActive)
      .map((d) => d.domain);
    if (domains.length > 0) {
      cachedDomains = domains;
      domainsFetchedAt = now;
    }
    return domains.length > 0 ? domains : ["mail.tm"];
  } catch {
    return cachedDomains.length > 0 ? cachedDomains : ["mail.tm"];
  }
}

export interface TempMailAccount {
  email: string;
  username: string;
  password: string;
  tempMailToken?: string;
}

export async function generateTempMailCredentials(usernamePrefix: string): Promise<TempMailAccount> {
  const domains = await getTempMailDomains();
  const domain = randomItem(domains);

  const adj = randomItem(adjectives);
  const noun = randomItem(nouns);
  const num = randomNumber(100, 9999);
  const hash = crypto.randomBytes(2).toString("hex");

  const localPart = `${usernamePrefix}.${adj}${noun}${num}${hash}`;
  const email = `${localPart}@${domain}`;
  const password = generatePassword(14);
  const username = localPart;

  try {
    const createRes = await fetch("https://api.mail.tm/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ address: email, password }),
      signal: AbortSignal.timeout(10000),
    });

    if (createRes.ok) {
      // Try to get token (optional — store for future use)
      const tokenRes = await fetch("https://api.mail.tm/token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ address: email, password }),
        signal: AbortSignal.timeout(8000),
      });
      const tokenData = tokenRes.ok ? (await tokenRes.json() as { token?: string }) : {};
      return { email, username, password, tempMailToken: tokenData.token };
    }

    // If mail.tm account creation fails (rate limit etc.), fall back to local gen
    const fallback = generateCredentials(usernamePrefix, domain);
    return fallback;
  } catch {
    const fallback = generateCredentials(usernamePrefix, domain);
    return fallback;
  }
}
