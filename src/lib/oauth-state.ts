import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

const STATE_COOKIE = "calsync_oauth_state";

/** Generates a CSRF-safe random state value and stashes it in a short-lived cookie so the callback can verify it. */
export async function createOAuthState(): Promise<string> {
  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes to complete the OAuth dance
  });
  return state;
}

export async function verifyAndConsumeOAuthState(receivedState: string | null): Promise<boolean> {
  const cookieStore = await cookies();
  const expected = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);
  return Boolean(expected) && Boolean(receivedState) && expected === receivedState;
}
