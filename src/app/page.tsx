import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { CalendarClock, Bell, ShieldCheck } from "lucide-react";

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
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
          <CalendarClock className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Never double-book again
        </h1>
        <p className="mt-3 text-balance text-slate-600 dark:text-slate-400">
          Connect your Gmail and Outlook calendars. We&apos;ll watch both of them for you and let you know
          the moment two meetings collide, or a new one shows up.
        </p>

        {errorMessage && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <a href="/api/auth/google/start">
            <Button
              size="lg"
              className="w-full border border-slate-300 bg-white text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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

        <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
          You can connect the other one right after — no setup, no technical steps.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
          <Feature
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Read-only access"
            desc="We only ever read your calendar events — never edit or delete them."
          />
          <Feature
            icon={<Bell className="h-5 w-5" />}
            title="Instant alerts"
            desc="Get notified in-app and on your device the moment there's a clash."
          />
        </div>
      </div>
    </main>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
        {icon}
      </div>
      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{desc}</p>
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
