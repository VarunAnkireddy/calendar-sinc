# Calendar Sync

Connects a person's Gmail and Outlook calendars, watches both for clashing meetings, and
alerts them in-app and (optionally) via a browser push notification the moment something
new shows up. Built with Next.js (App Router), Postgres + Drizzle ORM, and no third-party
auth library — sign-in is two OAuth buttons and nothing else for the end user to configure.

**For the end user:** open the site, click "Continue with Google" or "Continue with
Outlook", then optionally connect the other one from Settings. That's the entire product
experience — everything past that point (syncing, clash detection, alerts) runs on its own.

This document is for whoever is deploying and maintaining the app, not the end user.

## How it works

- `src/app/page.tsx` — the sign-in screen.
- Custom OAuth flow (`src/app/api/auth/**`, `src/lib/providers/**`) — no NextAuth/Auth.js.
  Each provider gets its own `start` (redirect to consent screen) and `callback` (exchange
  code, upsert user + tokens, set a signed session cookie) route. This is what lets one
  person connect *both* Gmail and Outlook to the same account without fighting a
  library's account-linking rules.
- `src/lib/sync.ts` — the sync engine. Fetches events from both connected calendars,
  diffs them against the last-seen cache in Postgres, writes a `notification` row for
  every new event, cancelled event, and cross-provider time overlap ("clash"), and sends
  a browser push notification if any of those happened.
- `src/app/api/cron/sync/route.ts` — polled every 5 minutes by Vercel Cron (`vercel.json`)
  to run the sync for every user. `src/app/api/sync/route.ts` lets the signed-in user
  trigger an immediate sync (used by the refresh button and right after connecting a
  calendar).
- `src/app/dashboard` / `src/app/settings` — the UI. Both are behind `src/middleware.ts`,
  which checks the session cookie before allowing access.

Access is **read-only**: the app only ever requests `calendar.readonly` (Google) and
`Calendars.Read` (Microsoft Graph) — it cannot edit or delete anything on either account.

## 1. Prerequisites

- A [Vercel](https://vercel.com) account (or any host that runs Next.js — Vercel is the
  path of least resistance because of the built-in cron support).
- A Postgres database. [Neon](https://neon.tech) has a free tier that works well here.
- A Google Cloud project and an Azure (Microsoft Entra ID) app registration — steps below.
- Node.js 20+ and npm, for local setup.

## 2. Google Cloud OAuth setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/), create a project
   (or pick an existing one).
2. **APIs & Services → Library** — enable the **Google Calendar API**.
3. **APIs & Services → OAuth consent screen** — choose **External**, fill in the app name,
   support email, and developer contact. Add the scope
   `https://www.googleapis.com/auth/calendar.readonly`.
   - While the app is in **Testing** mode, only the test users you list on this screen can
     sign in — that's fine for personal use or a small team (add their Google accounts
     under "Test users"). Taking it to **Production** for the public requires Google to
     verify the app (since calendar access is a "sensitive" scope), which involves a
     review and a privacy policy URL. Skip this unless you're shipping to strangers.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID** — type **Web
   application**. Add an authorized redirect URI:
   - `https://YOUR_DOMAIN/api/auth/google/callback` (production)
   - `http://localhost:3000/api/auth/google/callback` (local dev — add this too)
5. Copy the **Client ID** and **Client secret** — these become `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`.

## 3. Microsoft (Outlook) app registration

1. Go to the [Azure Portal](https://portal.azure.com/) → **Microsoft Entra ID** → **App
   registrations → New registration**.
2. Name it, and under **Supported account types** choose **"Accounts in any organizational
   directory and personal Microsoft accounts"** (this is what lets both work/school
   Outlook and personal outlook.com/hotmail accounts sign in).
3. Under **Redirect URI**, choose **Web** and add:
   - `https://YOUR_DOMAIN/api/auth/microsoft/callback` (production)
   - `http://localhost:3000/api/auth/microsoft/callback` (local dev)
4. **API permissions → Add a permission → Microsoft Graph → Delegated permissions** —
   add `openid`, `email`, `profile`, `offline_access`, `User.Read`, `Calendars.Read`.
   (If your org requires admin consent for these, click "Grant admin consent".)
5. **Certificates & secrets → New client secret** — copy the **value** immediately (it's
   only shown once). This becomes `MICROSOFT_CLIENT_SECRET`; the **Application (client)
   ID** on the Overview page becomes `MICROSOFT_CLIENT_ID`.

## 4. Database

1. Create a Postgres database (e.g. a free Neon project) and copy its connection string
   into `DATABASE_URL`.
2. Apply the schema:
   ```bash
   npm install
   npm run db:migrate
   ```
   This runs the SQL in `drizzle/` against `DATABASE_URL`. Re-run it any time the schema
   changes (e.g. after pulling an update to this app).

## 5. Push notifications (optional)

Skip this section if you're fine with alerts appearing only inside the app (the in-app
bell/toast always works regardless). To also get a real OS-level push notification:

```bash
npm run vapid:generate
```

Copy the printed public key into `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key into
`VAPID_PRIVATE_KEY`. Users then turn push on for themselves from **Settings**.

## 6. Environment variables

Copy `.env.example` to `.env.local` for local dev, and set the same variables in your
Vercel project (**Settings → Environment Variables**) for production:

| Variable | Where it comes from |
|---|---|
| `APP_URL` | Your deployed URL, no trailing slash (e.g. `https://calsync.vercel.app`) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `DATABASE_URL` | Your Postgres connection string |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Step 2 |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Step 3 |
| `CRON_SECRET` | `openssl rand -base64 32` — locks down `/api/cron/sync` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Step 5 (optional) |

## 7. Deploy

```bash
npx vercel deploy --prod
```

(or connect the GitHub repo in the Vercel dashboard and let it deploy on push). Make sure
every variable above is set in the Vercel project first.

**About the 5-minute sync schedule (`vercel.json`):** Vercel's free (Hobby) plan only
runs cron jobs once a day; the 5-minute interval configured here needs a **Pro** plan. On
Hobby, either change the schedule to `0 6 * * *` (once daily) or point a free external
scheduler (e.g. [cron-job.org](https://cron-job.org) or a scheduled GitHub Actions
workflow) at `GET https://YOUR_DOMAIN/api/cron/sync` every 5 minutes with the header
`Authorization: Bearer YOUR_CRON_SECRET`.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values from the steps above
npm run db:migrate
npm run dev
```

Use `http://localhost:3000` as `APP_URL` and make sure you added the localhost redirect
URIs in steps 2 and 3 — both Google and Microsoft allow plain `http://localhost` redirect
URIs for development.

## Troubleshooting

- **"That sign-in link expired" / `invalid_state`** — the OAuth CSRF cookie didn't survive
  the round trip. Usually means `APP_URL` doesn't match the URL you're actually visiting,
  or cookies are blocked. Make sure `APP_URL` has no trailing slash and matches exactly.
- **"Needs attention" next to a connected account in Settings** — the refresh token
  stopped working (commonly because the user revoked access from their Google/Microsoft
  account settings). They just need to reconnect that provider from Settings.
- **A user reports missing clash alerts** — check `/api/cron/sync` is actually being hit
  on schedule (Vercel dashboard → your project → Cron Jobs → view runs), and that
  `CRON_SECRET` matches between Vercel and your scheduler if you're using an external one.
- **Google/Microsoft says the app isn't verified** — expected while the Google OAuth
  consent screen is in "Testing" mode; add the person's email as a test user (Step 2.3).
- **`middleware` deprecation warning during build** — Next.js 16 renamed the convention to
  `proxy.ts`; the app still works fine on `middleware.ts`, this is just a heads-up, not
  an error.

## Tech stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS · Postgres · Drizzle ORM · `web-push` ·
hand-rolled OAuth (no external auth library) · deployed on Vercel.
