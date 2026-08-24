import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauth-state";
import { getGoogleAuthUrl } from "@/lib/providers/google";

export async function GET() {
  const state = await createOAuthState();
  return NextResponse.redirect(getGoogleAuthUrl(state));
}
