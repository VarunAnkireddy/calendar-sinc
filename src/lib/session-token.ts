import { jwtVerify } from "jose";

export const SESSION_COOKIE_NAME = "calsync_session";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. Generate one with `openssl rand -base64 32` and add it to your environment variables."
    );
  }
  return new TextEncoder().encode(secret);
}

/** Pure token verification with no dependency on next/headers — safe to use from middleware (Edge runtime) as well as route handlers. */
export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.userId === "string" ? payload.userId : null;
  } catch {
    return null;
  }
}
