import { NextResponse } from "next/server";
import {
  bearerFromRequest,
  getAuthStatus,
  verifySessionToken,
} from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const status = await getAuthStatus();
    const token = bearerFromRequest(request);
    const unlocked = token ? await verifySessionToken(token) : false;
    return NextResponse.json({ ...status, unlocked });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Status failed";
    // DB may be down on first boot before migrate
    return NextResponse.json(
      { hasPassword: false, unlocked: false, error: message },
      { status: 503 },
    );
  }
}
