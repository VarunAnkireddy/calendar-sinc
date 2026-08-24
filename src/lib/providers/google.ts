import "server-only";
import { env } from "@/lib/env";
import type { NormalizedEvent, OAuthTokenSet, ProviderProfile } from "./types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

function redirectUri() {
  return `${env.appUrl}/api/auth/google/callback`;
}

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent", // ensures a refresh_token is issued every time
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<OAuthTokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    scope: data.scope ?? null,
  };
}

export async function refreshGoogleToken(refreshToken: string): Promise<OAuthTokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: refreshToken, // Google only returns a new refresh_token rarely; keep the existing one
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    scope: data.scope ?? null,
  };
}

export async function getGoogleProfile(accessToken: string): Promise<ProviderProfile> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Google profile: ${res.status}`);
  }
  const data = await res.json();
  return {
    providerAccountId: data.sub,
    email: data.email,
    name: data.name ?? null,
    image: data.picture ?? null,
  };
}

export async function fetchGoogleEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date
): Promise<NormalizedEvent[]> {
  const events: NormalizedEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${EVENTS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch Google events: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();

    for (const item of data.items ?? []) {
      const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);
      const start = item.start?.dateTime ?? item.start?.date;
      const end = item.end?.dateTime ?? item.end?.date;
      if (!start || !end || !item.id) continue;

      events.push({
        externalId: item.id,
        calendarName: "Gmail Calendar",
        title: item.summary ?? "(No title)",
        location: item.location ?? null,
        start: new Date(start),
        end: new Date(end),
        isAllDay,
        status: item.status === "cancelled" ? "cancelled" : item.status === "tentative" ? "tentative" : "confirmed",
        htmlLink: item.htmlLink ?? null,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return events;
}
