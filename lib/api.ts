import { NextResponse } from "next/server";
import { bearerFromRequest, verifySessionToken } from "@/lib/auth";

export async function unauthorizedIfNeeded(request: Request) {
  const ok = await verifySessionToken(bearerFromRequest(request));
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "no-store");
  }
  return NextResponse.json(data, { ...init, headers });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}
