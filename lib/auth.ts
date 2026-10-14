import { createHash, randomBytes } from "crypto";
import argon2 from "argon2";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, sessions } from "@/db/schema";
import { SESSION_STORAGE_KEY } from "@/lib/auth-constants";

export { SESSION_STORAGE_KEY };

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function ensureSettingsRow() {
  const existing = await db.select().from(appSettings).limit(1);
  if (existing.length === 0) {
    await db.insert(appSettings).values({ id: 1 });
  }
  const [row] = await db.select().from(appSettings).limit(1);
  return row;
}

export async function getAuthStatus() {
  const settings = await ensureSettingsRow();
  return {
    hasPassword: Boolean(settings.passwordHash),
  };
}

export async function setupPassword(password: string) {
  const settings = await ensureSettingsRow();
  if (settings.passwordHash) {
    throw new Error("Password already set");
  }
  const passwordHash = await argon2.hash(password);
  await db
    .update(appSettings)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(appSettings.id, 1));
  return createSession();
}

export async function unlock(password: string) {
  const settings = await ensureSettingsRow();
  if (!settings.passwordHash) {
    throw new Error("Password not set");
  }
  const ok = await argon2.verify(settings.passwordHash, password);
  if (!ok) {
    throw new Error("Invalid password");
  }
  return createSession();
}

export async function changePassword(current: string, next: string) {
  const settings = await ensureSettingsRow();
  if (!settings.passwordHash) {
    throw new Error("Password not set");
  }
  const ok = await argon2.verify(settings.passwordHash, current);
  if (!ok) {
    throw new Error("Invalid password");
  }
  const passwordHash = await argon2.hash(next);
  await db
    .update(appSettings)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(appSettings.id, 1));
  await db.delete(sessions);
}

async function createSession() {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  await db.insert(sessions).values({ tokenHash });
  return { token };
}

export async function verifySessionToken(token: string | null | undefined) {
  if (!token) return false;
  const tokenHash = hashToken(token);
  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);
  return Boolean(row);
}

export function bearerFromRequest(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}
