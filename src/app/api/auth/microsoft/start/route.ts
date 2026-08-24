import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/oauth-state";
import { getMicrosoftAuthUrl } from "@/lib/providers/microsoft";

export async function GET() {
  const state = await createOAuthState();
  return NextResponse.redirect(getMicrosoftAuthUrl(state));
}
