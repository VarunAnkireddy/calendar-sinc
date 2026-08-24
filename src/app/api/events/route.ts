import { NextResponse } from "next/server";
import { db } from "@/db";
import { calendarEvents } from "@/db/schema";
import { and, asc, eq, gte } from "drizzle-orm";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const now = new Date();
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.userId, userId), gte(calendarEvents.end, now)))
    .orderBy(asc(calendarEvents.start))
    .limit(200);

  return NextResponse.json({ events: rows });
}
