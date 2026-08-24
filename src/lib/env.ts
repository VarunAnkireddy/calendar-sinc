import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  get appUrl() {
    // Strip any trailing slash(es) — a stray one here (e.g. "https://x.com/")
    // would double up when routes append their own path, producing
    // ".../api/auth/..." with a double slash that Google's exact-match
    // redirect_uri check rejects.
    const raw = process.env.APP_URL ?? "http://localhost:3000";
    return raw.replace(/\/+$/, "");
  },
  get googleClientId() {
    return required("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret() {
    return required("GOOGLE_CLIENT_SECRET");
  },
  get microsoftClientId() {
    return required("MICROSOFT_CLIENT_ID");
  },
  get microsoftClientSecret() {
    return required("MICROSOFT_CLIENT_SECRET");
  },
  get cronSecret() {
    return process.env.CRON_SECRET;
  },
  get vapidPublicKey() {
    return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  },
  get vapidPrivateKey() {
    return process.env.VAPID_PRIVATE_KEY;
  },
};
