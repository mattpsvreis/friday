import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/schema";
import {
  jsonError,
  jsonOk,
  readJson,
  unauthorizedIfNeeded,
} from "@/lib/api";

export async function GET(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const rows = await db.select().from(categories);
  return jsonOk(rows);
}

export async function POST(request: Request) {
  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const body = await readJson<{ name?: string; kind?: "income" | "expense" }>(
    request,
  );
  if (!body.name?.trim()) return jsonError("name is required");
  if (body.kind !== "income" && body.kind !== "expense") {
    return jsonError("kind must be income or expense");
  }

  try {
    const [created] = await db
      .insert(categories)
      .values({ name: body.name.trim(), kind: body.kind })
      .returning();
    return jsonOk(created);
  } catch {
    return jsonError("Category name already exists or invalid", 409);
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
