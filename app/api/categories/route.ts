import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import {
  jsonError,
  jsonOk,
  readJson,
  unauthorizedIfNeeded,
} from "@/lib/api";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function normalizeColor(value: unknown, fallback = "#39ff14") {
  if (typeof value !== "string") return fallback;
  const color = value.trim();
  if (!HEX_COLOR.test(color)) return null;
  return color.toLowerCase();
}

export async function GET(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const rows = await db.select().from(categories);
  return jsonOk(rows);
}

export async function POST(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const body = await readJson<{
    name?: string;
    kind?: "income" | "expense";
    color?: string;
  }>(request);
  if (!body.name?.trim()) return jsonError("name is required");
  if (body.kind !== "income" && body.kind !== "expense") {
    return jsonError("kind must be income or expense");
  }
  const color = normalizeColor(body.color);
  if (!color) return jsonError("color must be a #RRGGBB hex value");

  try {
    const [created] = await db
      .insert(categories)
      .values({ name: body.name.trim(), kind: body.kind, color })
      .returning();
    return jsonOk(created);
  } catch {
    return jsonError("Category name already exists or invalid", 409);
  }
}

export async function PUT(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const body = await readJson<{
    id?: string;
    name?: string;
    kind?: "income" | "expense";
    color?: string;
  }>(request);
  if (!body.id) return jsonError("id is required");

  const patch: Partial<typeof categories.$inferInsert> = {};
  if (body.name !== undefined) {
    if (!body.name.trim()) return jsonError("name is required");
    patch.name = body.name.trim();
  }
  if (body.kind !== undefined) {
    if (body.kind !== "income" && body.kind !== "expense") {
      return jsonError("kind must be income or expense");
    }
    patch.kind = body.kind;
  }
  if (body.color !== undefined) {
    const color = normalizeColor(body.color);
    if (!color) return jsonError("color must be a #RRGGBB hex value");
    patch.color = color;
  }

  try {
    const [updated] = await db
      .update(categories)
      .set(patch)
      .where(eq(categories.id, body.id))
      .returning();
    if (!updated) return jsonError("Category not found", 404);
    return jsonOk(updated);
  } catch {
    return jsonError("Category update failed", 409);
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonError("id query parameter is required");

  await db.delete(categories).where(eq(categories.id, id));
  return jsonOk({ ok: true });
}
