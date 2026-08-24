import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function ConnectPrompt({ connected }: { connected: string[] }) {
  const needsGoogle = !connected.includes("google");
  const needsMicrosoft = !connected.includes("microsoft");

  return (
    <Card className="mb-6 border-indigo-200 bg-indigo-50/60 dark:border-indigo-900 dark:bg-indigo-950/30">
      <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
              Connect your other calendar
            </p>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              We can only catch clashes once both calendars are connected. Takes about 10 seconds.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {needsGoogle && (
            <a href="/api/auth/google/start">
              <Button variant="outline" size="sm">Connect Gmail</Button>
            </a>
          )}
          {needsMicrosoft && (
            <a href="/api/auth/microsoft/start">
              <Button variant="outline" size="sm">Connect Outlook</Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
