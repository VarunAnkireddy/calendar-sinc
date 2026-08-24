import "server-only";
import { db } from "@/db";
import { calendarEvents, notifications, syncStatus } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { getConnectedCalendars, fetchEventsForCalendar } from "@/lib/providers";
import { PROVIDER_LABELS, type ProviderId } from "@/lib/providers/types";
import { sendPushToUser } from "@/lib/push";

const SYNC_WINDOW_PAST_MS = 24 * 60 * 60 * 1000; // look back 1 day for events still in progress
const SYNC_WINDOW_FUTURE_DAYS = 30;
const CLASH_DEDUPE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // don't re-notify the same clash pair within 7 days

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export interface SyncResult {
  userId: string;
  newEvents: number;
  cancelledEvents: number;
  newClashes: number;
  errors: { provider: ProviderId; message: string }[];
}

export async function syncUserCalendars(userId: string): Promise<SyncResult> {
  const calendars = await getConnectedCalendars(userId);
  const now = new Date();
  const timeMin = new Date(now.getTime() - SYNC_WINDOW_PAST_MS);
  const timeMax = new Date(now.getTime() + SYNC_WINDOW_FUTURE_DAYS * 24 * 60 * 60 * 1000);

  const result: SyncResult = { userId, newEvents: 0, cancelledEvents: 0, newClashes: 0, errors: [] };
  const newlyInsertedIds: string[] = [];
  const newlyCancelled: { title: string; provider: ProviderId }[] = [];

  for (const cal of calendars) {
    const provider = cal.provider as ProviderId;
    try {
      const [statusRow] = await db
        .select()
        .from(syncStatus)
        .where(and(eq(syncStatus.userId, userId), eq(syncStatus.provider, provider)));
      const isFirstSync = !statusRow?.lastSyncedAt;

      const fetched = await fetchEventsForCalendar(cal, timeMin, timeMax);
      const fetchedIds = new Set(fetched.map((e) => e.externalId));

      const cached = await db
        .select()
        .from(calendarEvents)
        .where(and(eq(calendarEvents.userId, userId), eq(calendarEvents.provider, provider)));
      const cachedById = new Map(cached.map((e) => [e.externalId, e]));

      for (const ev of fetched) {
        const existing = cachedById.get(ev.externalId);
        if (!existing) {
          const [inserted] = await db
            .insert(calendarEvents)
            .values({
              userId,
              provider,
              externalId: ev.externalId,
              calendarName: ev.calendarName,
              title: ev.title,
              location: ev.location,
              start: ev.start,
              end: ev.end,
              isAllDay: ev.isAllDay,
              status: ev.status,
              htmlLink: ev.htmlLink,
            })
            .returning();
          newlyInsertedIds.push(inserted.id);

          if (!isFirstSync && ev.status !== "cancelled") {
            result.newEvents++;
            await db.insert(notifications).values({
              userId,
              type: "new_event",
              title: `New event on ${PROVIDER_LABELS[provider]}`,
              message: `"${ev.title}" was added — ${formatWhen(ev.start, ev.isAllDay)}`,
              relatedEventIds: [inserted.id],
            });
          }
        } else {
          await db
            .update(calendarEvents)
            .set({
              title: ev.title,
              location: ev.location,
              start: ev.start,
              end: ev.end,
              isAllDay: ev.isAllDay,
              status: ev.status,
              htmlLink: ev.htmlLink,
              lastSeenAt: new Date(),
            })
            .where(eq(calendarEvents.id, existing.id));
        }
      }

      // Anything we had cached for the future that didn't come back this time is gone/cancelled.
      const disappeared = cached.filter(
        (e) => !fetchedIds.has(e.externalId) && e.start.getTime() >= now.getTime() && e.status !== "cancelled"
      );
      for (const gone of disappeared) {
        await db
          .update(calendarEvents)
          .set({ status: "cancelled", lastSeenAt: new Date() })
          .where(eq(calendarEvents.id, gone.id));

        if (!isFirstSync) {
          result.cancelledEvents++;
          newlyCancelled.push({ title: gone.title, provider });
          await db.insert(notifications).values({
            userId,
            type: "cancelled",
            title: `Event cancelled on ${PROVIDER_LABELS[provider]}`,
            message: `"${gone.title}" was removed from the calendar`,
            relatedEventIds: [gone.id],
          });
        }
      }

      await db
        .insert(syncStatus)
        .values({ userId, provider, lastSyncedAt: new Date(), lastError: null })
        .onConflictDoUpdate({
          target: [syncStatus.userId, syncStatus.provider],
          set: { lastSyncedAt: new Date(), lastError: null },
        });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ provider, message });
      await db
        .insert(syncStatus)
        .values({ userId, provider, lastSyncedAt: null, lastError: message })
        .onConflictDoUpdate({
          target: [syncStatus.userId, syncStatus.provider],
          set: { lastError: message },
        });
    }
  }

  const clashCount = await detectClashes(userId, now);
  result.newClashes = clashCount;

  if (result.newEvents > 0 || result.cancelledEvents > 0 || result.newClashes > 0) {
    const parts: string[] = [];
    if (result.newClashes > 0) parts.push(`${result.newClashes} clash${result.newClashes > 1 ? "es" : ""}`);
    if (result.newEvents > 0) parts.push(`${result.newEvents} new event${result.newEvents > 1 ? "s" : ""}`);
    if (result.cancelledEvents > 0) parts.push(`${result.cancelledEvents} cancelled`);
    await sendPushToUser(userId, {
      title: "Calendar update",
      body: parts.join(", "),
      url: "/dashboard",
    });
  }

  return result;
}

async function detectClashes(userId: string, now: Date): Promise<number> {
  const upcoming = await db
    .select()
    .from(calendarEvents)
    .where(and(eq(calendarEvents.userId, userId), gte(calendarEvents.end, now)));

  const candidates = upcoming.filter((e) => !e.isAllDay && e.status !== "cancelled");

  // Only cross-provider pairs count as a "clash" worth alerting on — that's
  // the whole point of syncing two calendars in the first place.
  const byProvider: Record<string, typeof candidates> = {};
  for (const e of candidates) {
    (byProvider[e.provider] ??= []).push(e);
  }
  const providers = Object.keys(byProvider);
  if (providers.length < 2) return 0;

  const recentClashNotifications = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.type, "clash")));
  const alreadyNotified = new Set(
    recentClashNotifications
      .filter((n) => Date.now() - n.createdAt.getTime() < CLASH_DEDUPE_WINDOW_MS)
      .map((n) => pairKey((n.relatedEventIds as string[])[0], (n.relatedEventIds as string[])[1]))
  );

  let newClashes = 0;
  for (let i = 0; i < providers.length; i++) {
    for (let j = i + 1; j < providers.length; j++) {
      for (const a of byProvider[providers[i]]) {
        for (const b of byProvider[providers[j]]) {
          if (!overlaps(a.start, a.end, b.start, b.end)) continue;
          const key = pairKey(a.id, b.id);
          if (alreadyNotified.has(key)) continue;
          alreadyNotified.add(key);
          newClashes++;

          await db.insert(notifications).values({
            userId,
            type: "clash",
            title: "Schedule clash detected",
            message: `"${a.title}" (${PROVIDER_LABELS[a.provider as ProviderId]}) overlaps "${b.title}" (${PROVIDER_LABELS[b.provider as ProviderId]}) — ${formatWhen(a.start, false)}`,
            relatedEventIds: [a.id, b.id],
          });
        }
      }
    }
  }
  return newClashes;
}

function pairKey(idA: string, idB: string) {
  return [idA, idB].sort().join("|");
}

function formatWhen(date: Date, isAllDay: boolean): string {
  if (isAllDay) {
    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
