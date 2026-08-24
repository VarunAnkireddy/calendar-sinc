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
    return process.env.APP_URL ?? "http://localhost:3000";
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
