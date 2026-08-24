import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { connectedCalendars } from "@/db/schema";
import { env } from "@/lib/env";
import { syncUserCalendars } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Polled by Vercel Cron (see vercel.json) every 5 minutes. Vercel
 * automatically sends `Authorization: Bearer $CRON_SECRET` on scheduled
 * invocations when CRON_SECRET is set as an env var, which is what we
 * check below so nobody else can trigger a sync for free.
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
