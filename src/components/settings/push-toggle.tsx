"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BellRing, BellOff } from "lucide-react";
import { enableBrowserPush, getPushSubscriptionState } from "@/lib/push-client";

export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<NotificationPermission | "unsupported" | "loading">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushSubscriptionState().then(setState);
  }, []);

  if (!vapidPublicKey) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Push notifications aren&apos;t configured for this deployment yet — you&apos;ll still see alerts inside the app.
      </p>
    );
  }

  if (state === "loading") return null;

  if (state === "unsupported") {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Your browser doesn&apos;t support push notifications. You&apos;ll still see alerts inside the app.</p>;
  }

  if (state === "granted") {
    return (
      <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
        <BellRing className="h-4 w-4" /> Push notifications are on for this device.
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <BellOff className="h-4 w-4" /> Notifications are blocked in your browser settings. Enable them for this site to get alerts.
      </p>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const ok = await enableBrowserPush(vapidPublicKey);
        setState(ok ? "granted" : await getPushSubscriptionState());
        setBusy(false);
      }}
    >
      <BellRing className="h-4 w-4" /> {busy ? "Enabling…" : "Enable push notifications"}
    </Button>
  );
}
