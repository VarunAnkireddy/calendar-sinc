"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { CalendarClock, Bell, Settings, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NotificationDTO } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function typeAccent(type: string) {
  if (type === "clash") return "bg-red-500";
  if (type === "cancelled") return "bg-slate-400";
  return "bg-emerald-500";
}

export function DashboardHeader({
  user,
  initialNotifications,
}: {
  user: { name: string | null; email: string; image: string | null };
  initialNotifications: NotificationDTO[];
}) {
  const { data, mutate } = useSWR<{ notifications: NotificationDTO[]; unreadCount: number }>(
    "/api/notifications",
    fetcher,
    {
      fallbackData: { notifications: initialNotifications, unreadCount: initialNotifications.filter((n) => !n.read).length },
      refreshInterval: 20000,
    }
  );

  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    mutate();
  }

  async function syncNow() {
    setSyncing(true);
    try {
      await fetch("/api/sync", { method: "POST" });
      await mutate();
      window.dispatchEvent(new CustomEvent("calsync:refresh"));
    } finally {
      setSyncing(false);
    }
  }

  const unreadCount = data?.unreadCount ?? 0;
  const list = data?.notifications ?? [];

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <CalendarClock className="h-4.5 w-4.5" />
          </div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">Calendar Sync</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" onClick={syncNow} title="Sync now" aria-label="Sync now">
            <RefreshCw className={cn("h-4.5 w-4.5", syncing && "animate-spin")} />
          </Button>

          <div className="relative" ref={menuRef}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen((o) => !o)}
              aria-label="Notifications"
              className="relative"
            >
              <Bell className="h-4.5 w-4.5" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>

            {open && (
              <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Notifications</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {list.length === 0 && (
                    <p className="px-2 py-6 text-center text-sm text-slate-400">No notifications yet</p>
                  )}
                  {list.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        "flex gap-2.5 rounded-xl px-2 py-2.5 text-left",
                        !n.read && "bg-slate-50 dark:bg-slate-800/60"
                      )}
                    >
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", typeAccent(n.type))} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{n.title}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Link href="/settings">
            <Button variant="ghost" size="icon" aria-label="Settings">
              <Settings className="h-4.5 w-4.5" />
            </Button>
          </Link>

          <form action="/api/auth/logout" method="post">
            <Button variant="ghost" size="icon" type="submit" aria-label="Sign out" title="Sign out">
              <LogOut className="h-4.5 w-4.5" />
            </Button>
          </form>

          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="ml-1 h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {(user.name ?? user.email).slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
