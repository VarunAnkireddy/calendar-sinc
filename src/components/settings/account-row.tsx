"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle } from "lucide-react";
import type { ProviderId } from "@/lib/providers/types";

function timeAgo(iso: string | null) {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function AccountRow({
  provider,
  label,
  email,
  lastSyncedAt,
  lastError,
}: {
  provider: ProviderId;
  label: string;
  email: string;
  lastSyncedAt: string | null;
  lastError: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    if (!confirm(`Disconnect ${label}? We'll stop watching this calendar for clashes.`)) return;
    setBusy(true);
    try {
      await fetch(`/api/accounts?provider=${provider}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant={provider === "google" ? "google" : "microsoft"}>{label}</Badge>
          {lastError ? (
            <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-3.5 w-3.5" /> Needs attention
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Connected
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-slate-600 dark:text-slate-400">{email}</p>
        <p className="text-xs text-slate-400">Last synced {timeAgo(lastSyncedAt)}</p>
        {lastError && <p className="mt-1 text-xs text-red-500">{lastError}</p>}
      </div>
      <Button variant="outline" size="sm" onClick={disconnect} disabled={busy}>
        {busy ? "Removing…" : "Disconnect"}
      </Button>
    </div>
  );
}
