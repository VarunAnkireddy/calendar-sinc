import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  const unreadCount = rows.filter((r) => !r.read).length;
  return NextResponse.json({ notifications: rows, unreadCount });
}

export async function PATCH(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id, markAllRead } = body ?? {};

  if (markAllRead) {
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
    return NextResponse.json({ ok: true });
  }

  if (id) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "id or markAllRead is required" }, { status: 400 });
}
