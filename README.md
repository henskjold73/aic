# AIC Calendar

Track your GitHub Copilot AI Credit (AIU) usage against your monthly budget — with a live calendar, burn rate projection, per-day usage reports, and team leaderboards.

**Live at [aic-jade.vercel.app](https://aic-jade.vercel.app)**

---

## What it does

- **Calendar view** — each day shows your target % and projected actual % based on current burn rate
- **Run-out day** — the day you'll exceed your budget is marked with a red border
- **Auto-sync** — a background script reads your local Copilot SQLite DB every 20 minutes and pushes monthly totals plus a daily breakdown to the API
- **Report** (`/report`) — monthly history and per-day usage table, filterable by project
- **Team view** (`/team/{id}`) — members ranked by month-to-date burn and today's usage, with a cumulative team chart and budget burn status
- **Privacy page** (`/privacy`) — explains exactly what the sync script uploads

---

## Deploy your own

1. Fork this repo and push to GitHub
2. Create a project on [vercel.com](https://vercel.com) and import the repo
3. In Vercel → Storage, add a **Neon Postgres** database and connect it to your project (sets `DATABASE_URL` / `POSTGRES_URL`)
4. Deploy — Vercel auto-detects Vite and serves `api/` as serverless functions

Tables and migrations are applied lazily by `ensureSchema()` in `api/db.ts` (idempotent, once per cold start). It runs from the script write routes (`ping`, `usage`, `days`), team join and every `/api/me/*` call — including the `/api/me/session` request every page load makes — so the first visit or sync after a deploy migrates the database. There is no separate migration step.

5. Optional but recommended — sign-in with GitHub, so one account can span browsers and machines:
   - Create a GitHub **OAuth App** with callback URL `https://<your-host>/api/me/callback`
   - Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` and `SESSION_SECRET` (any random string of 32+ characters, e.g. `openssl rand -hex 32`) in Vercel. Optionally `APP_URL` to pin the public origin used for the callback.
   - Once everyone has signed in, set `LEGACY_KEY_API=off` to turn off the old key-only reads and key-based team calls (they return 403). Script uploads keep working.
   - Rotating `SESSION_SECRET` signs everyone out (sessions are stateless signed cookies).

> The sync scripts hard-code the production host (`aic-jade.vercel.app`) in `API=`. Edit `scripts/update-usage.sh` / `.ps1` if you self-host.

---

## Set up auto-sync

The sync script reads `~/.copilot/session-store.db` (written by Copilot CLI) and POSTs your monthly AIU total to your Vercel deployment every 20 minutes.

**macOS / Linux**
```bash
bash <(curl -sL https://raw.githubusercontent.com/henskjold73/aic/main/scripts/install-sync.sh)
```

**Windows (PowerShell)**
```powershell
irm https://raw.githubusercontent.com/henskjold73/aic/main/scripts/install-sync.ps1 | iex
```

The installer prints a one-time **pairing code** (valid 15 minutes). Sign in at `/devices` and enter it to link that machine to your account — repeat on every machine you use; the calendar adds them together. Prefer not to use an account? It also prints the sync UUID, which you can paste at `/auto` as before.

Optional: put a project label in `~/.config/aic/project` and daily rows will be tagged with it (shown in the report).

On Windows, scheduled syncs run without opening a console window. Rerun the install
command to update an existing installation; your UUID is preserved (and, if the machine is already linked, no new pairing code is shown).

To uninstall:

```bash
# macOS / Linux
bash <(curl -sL https://raw.githubusercontent.com/henskjold73/aic/main/scripts/uninstall-sync.sh)

# Windows
irm https://raw.githubusercontent.com/henskjold73/aic/main/scripts/uninstall-sync.ps1 | iex
```

---

## Join a team

If a teammate sends you a join link (`/team/{id}/join`), open it in your browser. Sign in with GitHub, enter your name, and join with the sync key your account already has (or install the sync script first and link it on `/devices`). Not using an account? Enter your sync UUID instead. Your usage appears in the team view as soon as the script runs.

To create a team yourself, go to `/team` on your deployment.

---

## Local dev

```bash
npm install
npm run dev        # Vite frontend only
npm run typecheck  # checks both src/ and api/ (tsconfig.json + api/tsconfig.json)
```

Requires a `.env.local` with your Postgres connection string:
```
DATABASE_URL=postgres://...
```

`vite dev` does not serve `api/`; use `vercel dev` to run the serverless functions locally.

---

## Architecture

```
Copilot CLI ──► ~/.copilot/session-store.db (SQLite)
                     │  update-usage.sh / .ps1 (launchd / Task Scheduler, every 20 min)
                     ▼
     /api/usage/{key}/ping | (root) | days (writes) ──►  Neon Postgres
                                                          accounts, sync_keys,
        React SPA (Vite), signed in with GitHub  ◄──      account_budgets,
        /api/me/*, /api/team/*  (polls every 20 min)      usage, usage_daily,
                                                          teams, team_members,
                                                          sync_meta, pairing_*
```

- `src/` — React 18 SPA, no router library (`src/router.ts` maps `location.pathname` to a route; `vercel.json` rewrites non-API paths to `index.html`). `@/` aliases `src/`.
- `src/types.ts` — shared request/response types imported by both the frontend and `api/`.
- `api/` — Vercel serverless handlers using `@neondatabase/serverless`; `db.ts` has schema + row coercion helpers (NUMERIC/BIGINT arrive as strings), `http.ts` has CORS/body/uuid helpers. Files starting with `_` (`_auth.ts` sessions/OAuth state, `_accounts.ts` attach/pairing/duplicate detection) are shared helpers, not functions. `api/me/[action].ts` is a single function dispatching all account routes, to stay under Vercel's function limit.
- `scripts/` — installers and the sync script for macOS/Linux (bash + `sqlite3`, launchd plist) and Windows (PowerShell, scheduled task).

### API

Script routes authenticate by sync key and are always on:

| Route | Methods | Purpose |
|---|---|---|
| `/api/usage/{key}` | POST | upsert the month's totals |
| `/api/usage/{key}/days` | POST | upsert daily rows (optional `project`) |
| `/api/usage/{key}/ping` | POST | script version + DB fingerprint (runs before any DB work); `request_pair_code` returns a pairing code for the installer |

Browser routes use the GitHub session cookie (same-origin only, `no-store`):

| Route | Methods | Purpose |
|---|---|---|
| `/api/me/login`, `/callback`, `/logout`, `/session` | GET/POST | GitHub sign-in; `session` returns the account, its keys (id + last 4 chars) and warnings |
| `/api/me/usage`, `/history`, `/days`, `/ping` | GET | usage summed across the account's non-disabled keys |
| `/api/me/budget` | PATCH | set this month's budget (`account_budgets`; also mirrored onto each key's `usage.budget` for rollback safety) |
| `/api/me/keys` | POST | attach a sync key (UUID) to the account |
| `/api/me/pair` | POST | attach the machine behind a one-time installer code (failed guesses are throttled per account) |
| `/api/me/devices`, `/device`, `/dismiss` | GET, PATCH, POST | Devices page: per-key usage, rename/disable a key, duplicate-key warnings |
| `/api/team` | POST; GET | create a team; list the signed-in account's teams |
| `/api/team/{id}` | GET `?month=` | team + one row per member (account) with usage summed across their keys |
| `/api/team/{id}/days` | GET `?month=[&member=]` | per-day AIU summed across members, or for one member (by account id) |
| `/api/team/{id}/today` | GET | each member's AIU today (`CURRENT_DATE`) |
| `/api/team/{id}/join`, `/leave` | POST | join (name max 32 chars) or leave, as the signed-in account |

Legacy key-only routes still work until `LEGACY_KEY_API=off` (then 403): `GET /api/usage/{key}` `/history` `/days` `/ping`, `PATCH /api/usage/{key}` (budget), `GET /api/team?uuid=`, and join/leave with a `uuid` in the body. `/api/admin/migrate` is retired and returns 410.

### Releasing a new sync script version

Bump `SCRIPT_VERSION` in `scripts/update-usage.sh` **and** `.ps1`, and `__CURRENT_SCRIPT_VERSION__` in `vite.config.ts`. `AicPanel` compares the user's last-pinged version to that constant and prompts them to re-run the installer when it's outdated. Users pick up changes by rerunning the install command.

---

## How it works

- Copilot CLI writes session data to `~/.copilot/session-store.db` (SQLite)
- Each run the sync script (1) pings the version, (2) sums the current month's `total_nano_aiu` from `assistant_usage_events` (÷ 1e9 → AIU) with token counts and POSTs to `/api/usage/{uuid}` (a zero payload if there's no usage yet), then (3) POSTs per-day totals to `/api/usage/{uuid}/days`
- Budget is set in the browser and stored per account and month, so teammates' budget ratios can be computed
- The frontend polls every 20 minutes; the team hook times refreshes just after the next expected sync (~20m20s)
- Team data comes from one SQL query joining `team_members` → `sync_keys` → `usage`, grouped by account
- Sync keys (UUIDs) are write credentials for scripts; browsers sign in with GitHub and see the sum of their account's keys. Team ids are unguessable links: anyone with one can read that team's usage (members are shown by account id, never by key). Team and account routes under `/api/me` are same-origin only
- Browser state (joined team ids, budget draft, last used AIU) lives in `localStorage` (`src/lib/storage.ts`). A sync UUID is stored there only for users who have not signed in; signing in attaches it to the account and removes it.
