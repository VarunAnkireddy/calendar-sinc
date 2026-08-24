import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { connectedCalendars } from "@/db/schema";
import { env } from "@/lib/env";
import { syncUserCalendars } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Hit by Vercel Cron once a day (see vercel.json — Hobby plan's limit) as a
 * safety net, and ideally also by a free external scheduler every few
 * minutes for real-time-ish alerts (see README's cron section). Vercel
 * automatically sends `Authorization: Bearer $CRON_SECRET` on scheduled
 * invocations when CRON_SECRET is set as an env var; an external scheduler
 * needs that same header set manually. Either way we check it below so
 * nobody else can trigger a sync for free.
 */
export async function GET(req: NextRequest) {
  if (env.cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${env.cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const rows = await db
    .selectDistinct({ userId: connectedCalendars.userId })
    .from(connectedCalendars);

  const results = [];
  for (const { userId } of rows) {
    try {
      const result = await syncUserCalendars(userId);
      results.push(result);
    } catch (err) {
      results.push({ userId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ syncedUsers: rows.length, results });
}
