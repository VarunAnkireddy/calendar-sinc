import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  sign_in_required: "Please sign in to continue.",
  invalid_state: "That sign-in link expired. Please try again.",
  google_connect_failed: "We couldn't connect your Gmail account. Please try again.",
  microsoft_connect_failed: "We couldn't connect your Outlook account. Please try again.",
  google_access_denied: "Google sign-in was cancelled.",
  microsoft_access_denied: "Outlook sign-in was cancelled.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const userId = await getSessionUserId();
  if (userId) redirect("/dashboard");

  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "Something went wrong. Please try again." : null;

  return (
    <main className="flex flex-1 items-center px-6 py-16 sm:px-10">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-14 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
        {/* Copy + sign-in */}
        <div>
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Gmail + Outlook, watched together</p>
          <h1 className="mt-3 text-4xl font-semibold leading-[1.1] tracking-tight text-stone-900 sm:text-5xl dark:text-stone-100">
            Never double-book
            <br />a meeting again.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-stone-600 dark:text-stone-400">
            Connect both calendars and we&apos;ll check them for you — the moment two meetings land at the
            same time, or a new one shows up, you&apos;ll know.
          </p>

          {errorMessage && (
            <div className="mt-6 max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          <div className="mt-8 flex max-w-sm flex-col gap-3">
            <a href="/api/auth/google/start">
              <Button
                size="lg"
                className="w-full border border-stone-300 bg-white text-stone-900 shadow-sm hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
              >
                <GoogleIcon />
                Continue with Google
              </Button>
            </a>
            <a href="/api/auth/microsoft/start">
              <Button size="lg" className="w-full bg-[#2564cf] hover:bg-[#1f56b3]">
                <MicrosoftIcon />
                Continue with Outlook
              </Button>
            </a>
          </div>

          <p className="mt-4 text-xs text-stone-400 dark:text-stone-500">
            You can connect the other one right after — no setup, no technical steps.
          </p>

          <div className="mt-10 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            <ShieldCheck className="h-4 w-4 shrink-0 text-stone-400 dark:text-stone-500" />
            Read-only access — we only ever look at your events, never edit or delete them.
          </div>
        </div>

        {/* Live preview of what the dashboard actually shows */}
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900">
          <p className="px-1 pb-3 text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
            Tuesday, Oct 14
          </p>
          <div className="space-y-2">
            <EventRow time="9:00 AM" title="Design review" provider="google" />
            <EventRow time="11:00 AM" title="Client walkthrough" provider="microsoft" clashWith="Team standup" />
            <EventRow time="11:15 AM" title="Team standup" provider="google" clashWith="Client walkthrough" />
            <EventRow time="2:30 PM" title="1:1 with manager" provider="microsoft" />
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <strong className="font-semibold">Clash detected</strong> — &quot;Client walkthrough&quot; (Outlook) overlaps
              &quot;Team standup&quot; (Gmail) by 15 minutes.
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}

function EventRow({
  time,
  title,
  provider,
  clashWith,
}: {
  time: string;
  title: string;
  provider: "google" | "microsoft";
  clashWith?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
        clashWith
          ? "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20"
          : "border-stone-100 dark:border-stone-800"
      }`}
    >
      <span className="tabular-nums w-16 shrink-0 text-xs text-stone-500 dark:text-stone-400">{time}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-stone-800 dark:text-stone-200">{title}</span>
      <Badge variant={provider} className="shrink-0">
        {provider === "google" ? "Gmail" : "Outlook"}
      </Badge>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.43-3.43C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.62l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 23 23" className="h-5 w-5" aria-hidden="true">
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  );
}
