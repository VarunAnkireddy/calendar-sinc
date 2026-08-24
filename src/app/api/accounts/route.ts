import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { connectedCalendars, calendarEvents, syncStatus } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/session";
import { PROVIDER_LABELS, type ProviderId } from "@/lib/providers/types";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const rows = await db
    .select({
      id: connectedCalendars.id,
      provider: connectedCalendars.provider,
      email: connectedCalendars.email,
      createdAt: connectedCalendars.createdAt,
    })
    .from(connectedCalendars)
    .where(eq(connectedCalendars.userId, userId));

  const statuses = await db.select().from(syncStatus).where(eq(syncStatus.userId, userId));

  const accounts = rows.map((r) => {
    const status = statuses.find((s) => s.provider === r.provider);
    return {
      ...r,
      label: PROVIDER_LABELS[r.provider as ProviderId] ?? r.provider,
      lastSyncedAt: status?.lastSyncedAt ?? null,
      lastError: status?.lastError ?? null,
    };
  });

  return NextResponse.json({ accounts });
}

export async function DELETE(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const provider = new URL(req.url).searchParams.get("provider") as ProviderId | null;
  if (!provider) {
    return NextResponse.json({ error: "provider is required" }, { status: 400 });
  }

  await db
    .delete(connectedCalendars)
    .where(and(eq(connectedCalendars.userId, userId), eq(connectedCalendars.provider, provider)));
  await db
    .delete(calendarEvents)
    .where(and(eq(calendarEvents.userId, userId), eq(calendarEvents.provider, provider)));
  await db
    .delete(syncStatus)
    .where(and(eq(syncStatus.userId, userId), eq(syncStatus.provider, provider)));

  return NextResponse.json({ ok: true });
}
