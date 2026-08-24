export type ProviderId = "google" | "microsoft";

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
}

export interface ProviderProfile {
  providerAccountId: string;
  email: string;
  name: string | null;
  image: string | null;
}

export interface NormalizedEvent {
  externalId: string;
  calendarName: string | null;
  title: string;
  location: string | null;
  start: Date;
  end: Date;
  isAllDay: boolean;
  status: "confirmed" | "cancelled" | "tentative";
  htmlLink: string | null;
}

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  google: "Gmail",
  microsoft: "Outlook",
};
