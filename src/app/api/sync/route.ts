import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/session";
import { syncUserCalendars } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Lets the signed-in user trigger an on-demand sync (e.g. right after connecting a calendar, or a manual refresh button) instead of waiting for the next cron tick. */
export async function POST() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const result = await syncUserCalendars(userId);
  return NextResponse.json(result);
}
