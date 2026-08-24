import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { getConnectedCalendars } from "@/lib/providers";
import { db } from "@/db";
import { calendarEvents, notifications } from "@/db/schema";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { DashboardHeader } from "@/components/dashboard/header";
import { ConnectPrompt } from "@/components/dashboard/connect-prompt";
import { Agenda } from "@/components/dashboard/agenda";
import type { EventDTO, NotificationDTO } from "@/lib/types";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const [calendars, eventRows, notificationRows] = await Promise.all([
    getConnectedCalendars(user.id),
    db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.userId, user.id), gte(calendarEvents.end, new Date())))
      .orderBy(asc(calendarEvents.start))
      .limit(200),
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50),
  ]);

  const initialEvents: EventDTO[] = eventRows.map((e) => ({
    ...e,
    start: e.start.toISOString(),
    end: e.end.toISOString(),
  }));
  const initialNotifications: NotificationDTO[] = notificationRows.map((n) => ({
    ...n,
    relatedEventIds: (n.relatedEventIds as string[]) ?? [],
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader
        user={{ name: user.name, email: user.email, image: user.image }}
        initialNotifications={initialNotifications}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        {calendars.length < 2 && <ConnectPrompt connected={calendars.map((c) => c.provider)} />}
        <Agenda initialEvents={initialEvents} calendarCount={calendars.length} />
      </main>
    </div>
  );
}
