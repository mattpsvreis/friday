import { connection } from "next/server";
import { jsonError, jsonOk, unauthorizedIfNeeded } from "@/lib/api";
import { getDashboardData, resolveDashboardMonth } from "@/lib/dashboard";

export async function GET(request: Request) {
  await connection();

  const unauthorized = await unauthorizedIfNeeded(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const yearRaw = url.searchParams.get("year");
  const monthRaw = url.searchParams.get("month");

  let view;
  try {
    view = resolveDashboardMonth({
      year: yearRaw ? Number(yearRaw) : undefined,
      month: monthRaw ? Number(monthRaw) : undefined,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Invalid month",
      400,
    );
  }

  const data = await getDashboardData(view);
  return jsonOk(data);
}
