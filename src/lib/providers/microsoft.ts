import "server-only";
import { env } from "@/lib/env";
import type { NormalizedEvent, OAuthTokenSet, ProviderProfile } from "./types";

// "common" accepts both personal Outlook/Hotmail accounts and work/school
// Microsoft 365 accounts, matching the "just sign in" goal for end users.
const AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

const SCOPES = [
  "openid",
  "email",
  "profile",
  "offline_access",
  "User.Read",
  "Calendars.Read",
].join(" ");

function redirectUri() {
  return `${env.appUrl}/api/auth/microsoft/callback`;
}

export function getMicrosoftAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.microsoftClientId,
    redirect_uri: redirectUri(),
    response_type: "code",
    response_mode: "query",
    scope: SCOPES,
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeMicrosoftCode(code: string): Promise<OAuthTokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.microsoftClientId,
      client_secret: env.microsoftClientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
      scope: SCOPES,
    }),
  });
  if (!res.ok) {
    throw new Error(`Microsoft token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    scope: data.scope ?? null,
  };
}

export async function refreshMicrosoftToken(refreshToken: string): Promise<OAuthTokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.microsoftClientId,
      client_secret: env.microsoftClientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: SCOPES,
    }),
  });
  if (!res.ok) {
    throw new Error(`Microsoft token refresh failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken, // Microsoft rotates refresh tokens
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    scope: data.scope ?? null,
  };
}

export async function getMicrosoftProfile(accessToken: string): Promise<ProviderProfile> {
  const res = await fetch(`${GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Microsoft profile: ${res.status}`);
  }
  const data = await res.json();
  const email = data.mail ?? data.userPrincipalName;
  return {
    providerAccountId: data.id,
    email,
    name: data.displayName ?? null,
    image: null, // Graph photo endpoint needs a separate binary call; skipped for simplicity
  };
}

export async function fetchMicrosoftEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date
): Promise<NormalizedEvent[]> {
  const events: NormalizedEvent[] = [];
  const params = new URLSearchParams({
    startDateTime: timeMin.toISOString(),
    endDateTime: timeMax.toISOString(),
    $top: "100",
    $orderby: "start/dateTime",
  });
  let url: string | null = `${GRAPH_BASE}/me/calendarview?${params.toString()}`;

  while (url) {
    const res: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch Microsoft events: ${res.status} ${await res.text()}`);
    }
    const data = await res.json();

    for (const item of data.value ?? []) {
      if (!item.id || !item.start?.dateTime || !item.end?.dateTime) continue;
      events.push({
        externalId: item.id,
        calendarName: "Outlook Calendar",
        title: item.subject ?? "(No title)",
        location: item.location?.displayName ?? null,
        start: new Date(`${item.start.dateTime}Z`),
        end: new Date(`${item.end.dateTime}Z`),
        isAllDay: Boolean(item.isAllDay),
        status: item.isCancelled ? "cancelled" : item.responseStatus?.response === "tentativelyAccepted" ? "tentative" : "confirmed",
        htmlLink: item.webLink ?? null,
      });
    }

    url = data["@odata.nextLink"] ?? null;
  }

  return events;
}
