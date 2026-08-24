"use client";

import { useEffect, useMemo } from "react";
import useSWR from "swr";
import { format, isToday, isTomorrow } from "date-fns";
import { MapPin, CalendarX2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EventDTO } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function dayLabel(date: Date) {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEEE, MMM d");
}

function providerBadgeVariant(provider: string) {
  return provider === "google" ? "google" : "microsoft";
}

function providerLabel(provider: string) {
  return provider === "google" ? "Gmail" : "Outlook";
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

export function Agenda({
  initialEvents,
  calendarCount,
}: {
  initialEvents: EventDTO[];
  calendarCount: number;
}) {
  const { data, mutate } = useSWR<{ events: EventDTO[] }>("/api/events", fetcher, {
    fallbackData: { events: initialEvents },
    refreshInterval: 30000,
  });

  useEffect(() => {
    const handler = () => mutate();
    window.addEventListener("calsync:refresh", handler);
    return () => window.removeEventListener("calsync:refresh", handler);
  }, [mutate]);

  const events = useMemo(
    () =>
      (data?.events ?? [])
        .filter((e) => e.status !== "cancelled")
        .map((e) => ({ ...e, startDate: new Date(e.start), endDate: new Date(e.end) })),
    [data]
  );

  const clashIds = useMemo(() => {
    const clashing = new Map<string, string[]>();
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const a = events[i];
        const b = events[j];
        if (a.provider === b.provider || a.isAllDay || b.isAllDay) continue;
        if (!overlaps(a.startDate, a.endDate, b.startDate, b.endDate)) continue;
        clashing.set(a.id, [...(clashing.get(a.id) ?? []), b.title]);
        clashing.set(b.id, [...(clashing.get(b.id) ?? []), a.title]);
      }
    }
    return clashing;
  }, [events]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const e of events) {
      const key = e.isAllDay ? format(e.startDate, "yyyy-MM-dd") : format(e.startDate, "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  if (calendarCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
        <CalendarX2 className="mb-3 h-8 w-8 text-slate-400" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No calendars connected yet</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Connect Gmail or Outlook above to see your schedule here.</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
        <CalendarX2 className="mb-3 h-8 w-8 text-slate-400" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Nothing on the calendar</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Nothing scheduled in the next 30 days.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map(([key, dayEvents]) => (
        <section key={key}>
          <h2 className="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {dayLabel(dayEvents[0].startDate)}
          </h2>
          <div className="space-y-2">
            {dayEvents.map((e) => {
              const clash = clashIds.get(e.id);
              return (
                <div
                  key={e.id}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border bg-white p-3.5 dark:bg-slate-900",
                    clash
                      ? "border-red-300 ring-1 ring-red-200 dark:border-red-800 dark:ring-red-900"
                      : "border-slate-200 dark:border-slate-800"
                  )}
                >
                  <div className="w-20 shrink-0 pt-0.5 text-right text-sm text-slate-500 dark:text-slate-400">
                    {e.isAllDay ? "All day" : format(e.startDate, "h:mm a")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{e.title}</p>
                      <Badge variant={providerBadgeVariant(e.provider)}>{providerLabel(e.provider)}</Badge>
                      {clash && <Badge variant="clash"><AlertTriangle className="h-3 w-3" /> Clash</Badge>}
                    </div>
                    {e.location && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <MapPin className="h-3 w-3" /> {e.location}
                      </p>
                    )}
                    {clash && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                        Clashes with {clash.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
