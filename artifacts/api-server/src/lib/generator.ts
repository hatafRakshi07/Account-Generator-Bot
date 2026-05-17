import crypto from "crypto";

const adjectives = ["swift", "bold", "calm", "dark", "fast", "keen", "pure", "slim", "warm", "wild", "cool", "epic", "iron", "jade", "lime"];
const nouns = ["wolf", "hawk", "bear", "lion", "fox", "oak", "sky", "star", "ray", "gem", "arc", "byte", "core", "data", "node"];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePassword(length = 12): string {
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
