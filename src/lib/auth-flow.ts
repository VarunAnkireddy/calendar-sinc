import "server-only";
import { db } from "@/db";
import { users, connectedCalendars } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getSessionUserId, createSession } from "@/lib/session";
import type { OAuthTokenSet, ProviderId, ProviderProfile } from "@/lib/providers/types";

/**
 * Shared logic for both the Google and Microsoft OAuth callbacks.
 * Handles three cases uniformly:
 *  1. Nobody is signed in and this email is new -> create a user + sign them in.
 *  2. Nobody is signed in but this email already has an account -> sign them in.
 *  3. Somebody is already signed in (they're connecting a second calendar,
 *     e.g. Outlook after Gmail) -> attach the calendar to the current user.
 */
export async function completeOAuthConnection(
  provider: ProviderId,
  profile: ProviderProfile,
  tokens: OAuthTokenSet
): Promise<{ userId: string }> {
  const currentUserId = await getSessionUserId();

  let userId: string;

  if (currentUserId) {
    userId = currentUserId;
  } else {
    const [existing] = await db.select().from(users).where(eq(users.email, profile.email));
    if (existing) {
      userId = existing.id;
    } else {
      const [created] = await db
        .insert(users)
        .values({ email: profile.email, name: profile.name, image: profile.image })
        .returning();
      userId = created.id;
    }
  }

  const [existingCalendar] = await db
    .select()
    .from(connectedCalendars)
    .where(and(eq(connectedCalendars.userId, userId), eq(connectedCalendars.provider, provider)));

  if (existingCalendar) {
    await db
      .update(connectedCalendars)
      .set({
        providerAccountId: profile.providerAccountId,
        email: profile.email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? existingCalendar.refreshToken,
        expiresAt: tokens.expiresAt,
        scope: tokens.scope,
        updatedAt: new Date(),
      })
      .where(eq(connectedCalendars.id, existingCalendar.id));
  } else {
    await db.insert(connectedCalendars).values({
      userId,
      provider,
      providerAccountId: profile.providerAccountId,
      email: profile.email,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
    });
  }

  await createSession(userId);
  return { userId };
}
