import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { getConnectedCalendars } from "@/lib/providers";
import { db } from "@/db";
import { syncStatus } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { AccountRow } from "@/components/settings/account-row";
import { PushToggle } from "@/components/settings/push-toggle";
import { PROVIDER_LABELS, type ProviderId } from "@/lib/providers/types";
import { env } from "@/lib/env";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const [calendars, statuses] = await Promise.all([
    getConnectedCalendars(user.id),
    db.select().from(syncStatus).where(eq(syncStatus.userId, user.id)),
  ]);

  const accounts = calendars.map((c) => {
    const status = statuses.find((s) => s.provider === c.provider);
    return {
      provider: c.provider as ProviderId,
      email: c.email,
      lastSyncedAt: status?.lastSyncedAt?.toISOString() ?? null,
      lastError: status?.lastError ?? null,
    };
  });

  const missing: ProviderId[] = (["google", "microsoft"] as ProviderId[]).filter(
    (p) => !calendars.some((c) => c.provider === p)
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <h1 className="mb-1 text-2xl font-semibold text-stone-900 dark:text-stone-100">Settings</h1>
      <p className="mb-6 text-sm text-stone-500 dark:text-stone-400">Signed in as {user.email}</p>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Connected calendars</CardTitle>
          <CardDescription>We only ever read events — nothing is edited or deleted on your accounts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.map((a) => (
            <AccountRow key={a.provider} {...a} label={PROVIDER_LABELS[a.provider]} />
          ))}

          {missing.length > 0 && (
            <div className="flex flex-col gap-2 pt-1 sm:flex-row">
              {missing.map((p) => (
                <a key={p} href={`/api/auth/${p}/start`} className="flex-1">
                  <Button variant="outline" className="w-full">
                    Connect {PROVIDER_LABELS[p]}
                  </Button>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Get an alert on this device the moment a clash or new event is found.</CardDescription>
        </CardHeader>
        <CardContent>
          <PushToggle vapidPublicKey={env.vapidPublicKey ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/api/auth/logout" method="post">
            <Button variant="destructive" type="submit">Sign out</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
