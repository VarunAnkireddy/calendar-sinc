import "server-only";
import { db } from "@/db";
import { connectedCalendars } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import * as google from "./google";
import * as microsoft from "./microsoft";
import type { NormalizedEvent, ProviderId } from "./types";

type ConnectedCalendarRow = typeof connectedCalendars.$inferSelect;

const REFRESH_SKEW_MS = 5 * 60 * 1000; // refresh 5 minutes before actual expiry

/** Returns a usable access token for this connected calendar, transparently refreshing (and persisting) it if it's expired or close to it. */
export async function getValidAccessToken(row: ConnectedCalendarRow): Promise<string> {
  const isExpired =
    row.expiresAt && row.expiresAt.getTime() - REFRESH_SKEW_MS < Date.now();

  if (!isExpired) {
    return row.accessToken;
  }

  if (!row.refreshToken) {
    throw new Error(
      `${row.provider} access token expired and no refresh token is available — the user needs to reconnect this calendar.`
    );
  }

  const fresh =
    row.provider === "google"
      ? await google.refreshGoogleToken(row.refreshToken)
      : await microsoft.refreshMicrosoftToken(row.refreshToken);

  await db
    .update(connectedCalendars)
    .set({
      accessToken: fresh.accessToken,
      refreshToken: fresh.refreshToken ?? row.refreshToken,
      expiresAt: fresh.expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(connectedCalendars.id, row.id));

  return fresh.accessToken;
}

export async function fetchEventsForCalendar(
  row: ConnectedCalendarRow,
  timeMin: Date,
  timeMax: Date
): Promise<NormalizedEvent[]> {
  const accessToken = await getValidAccessToken(row);
  return row.provider === "google"
    ? google.fetchGoogleEvents(accessToken, timeMin, timeMax)
    : microsoft.fetchMicrosoftEvents(accessToken, timeMin, timeMax);
}

export async function getConnectedCalendar(userId: string, provider: ProviderId) {
  const [row] = await db
    .select()
    .from(connectedCalendars)
    .where(and(eq(connectedCalendars.userId, userId), eq(connectedCalendars.provider, provider)));
  return row ?? null;
}

export async function getConnectedCalendars(userId: string) {
  return db.select().from(connectedCalendars).where(eq(connectedCalendars.userId, userId));
}
