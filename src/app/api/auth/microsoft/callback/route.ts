import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyAndConsumeOAuthState } from "@/lib/oauth-state";
import { exchangeMicrosoftCode, getMicrosoftProfile } from "@/lib/providers/microsoft";
import { completeOAuthConnection } from "@/lib/auth-flow";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const failUrl = new URL("/", env.appUrl);

  if (error) {
    failUrl.searchParams.set("error", `microsoft_${error}`);
    return NextResponse.redirect(failUrl);
  }

  const stateOk = await verifyAndConsumeOAuthState(state);
  if (!stateOk || !code) {
    failUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(failUrl);
  }

  try {
    const tokens = await exchangeMicrosoftCode(code);
    const profile = await getMicrosoftProfile(tokens.accessToken);
    await completeOAuthConnection("microsoft", profile, tokens);
  } catch (err) {
    console.error("Microsoft OAuth callback failed", err);
    failUrl.searchParams.set("error", "microsoft_connect_failed");
    return NextResponse.redirect(failUrl);
  }

  return NextResponse.redirect(new URL("/dashboard?connected=microsoft", env.appUrl));
}
