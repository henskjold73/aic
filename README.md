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

Tables are created lazily by `ensureSchema()` in `api/db.ts`. It currently runs only from the `ping` endpoint, so the first sync-script run (which pings first) bootstraps the schema.

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

The script prints a UUID — paste it at `/auto` on your deployment to link your local usage to the app.

Optional: put a project label in `~/.config/aic/project` and daily rows will be tagged with it (shown in the report).

On Windows, scheduled syncs run without opening a console window. Rerun the install
command to update an existing installation; your UUID is preserved.

To uninstall:

```bash
# macOS / Linux
bash <(curl -sL https://raw.githubusercontent.com/henskjold73/aic/main/scripts/uninstall-sync.sh)

# Windows
irm https://raw.githubusercontent.com/henskjold73/aic/main/scripts/uninstall-sync.ps1 | iex
```

---

## Join a team

If a teammate sends you a join link (`/team/{id}/join`), open it in your browser. The page walks you through installing the sync script and entering your UUID. Your usage will appear in the team view as soon as the script runs.

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
        /api/usage/{uuid}/ping | (root) | days     ──►  Neon Postgres
                                                          teams, team_members,
        React SPA (Vite) polls every 20 min  ◄──          usage, usage_daily,
        /api/usage, /api/team/*                           sync_meta
```

- `src/` — React 18 SPA, no router library (`src/router.ts` maps `location.pathname` to a route; `vercel.json` rewrites non-API paths to `index.html`). `@/` aliases `src/`.
- `src/types.ts` — shared request/response types imported by both the frontend and `api/`.
- `api/` — Vercel serverless handlers using `@neondatabase/serverless`; `db.ts` has schema + row coercion helpers (NUMERIC/BIGINT arrive as strings), `http.ts` has CORS/body/uuid helpers.
- `scripts/` — installers and the sync script for macOS/Linux (bash + `sqlite3`, launchd plist) and Windows (PowerShell, scheduled task).

### API

| Route | Methods | Purpose |
|---|---|---|
| `/api/usage/{uuid}` | GET, POST, PATCH | current-month record; script upserts totals; browser PATCHes `budget` |
| `/api/usage/{uuid}/days` | GET, POST | daily rows for `?month=`; script upserts daily rows |
| `/api/usage/{uuid}/history` | GET | all monthly rows, newest first |
| `/api/usage/{uuid}/ping` | GET, POST | last-seen script version (ping runs before any DB work) |
| `/api/team` | GET `?uuid=`, POST | list a user's teams; create a team |
| `/api/team/{id}` | GET `?month=` | team + members' usage for the month |
| `/api/team/{id}/days` | GET `?month=` | per-day AIU summed across members |
| `/api/team/{id}/today` | GET | each member's AIU today (`CURRENT_DATE`) |
| `/api/team/{id}/join` | POST | add/rename a member (name max 32 chars) |
| `/api/team/{id}/leave` | POST | remove a member |
| `/api/admin/migrate` | any | retired; returns 410 (Blob → Postgres migration is done) |

### Releasing a new sync script version

Bump `SCRIPT_VERSION` in `scripts/update-usage.sh` **and** `.ps1`, and `__CURRENT_SCRIPT_VERSION__` in `vite.config.ts`. `AicPanel` compares the user's last-pinged version to that constant and prompts them to re-run the installer when it's outdated. Users pick up changes by rerunning the install command.

---

## How it works

- Copilot CLI writes session data to `~/.copilot/session-store.db` (SQLite)
- Each run the sync script (1) pings the version, (2) sums the current month's `total_nano_aiu` from `assistant_usage_events` (÷ 1e9 → AIU) with token counts and POSTs to `/api/usage/{uuid}` (a zero payload if there's no usage yet), then (3) POSTs per-day totals to `/api/usage/{uuid}/days`
- Budget is set in the browser and stored server-side via PATCH, so teammates' budget ratios can be computed
- The frontend polls every 20 minutes; the team hook times refreshes just after the next expected sync (~20m20s)
- Team data comes from a single joined SQL query over `team_members` and `usage`
- UUIDs act as unguessable bearer tokens (user ids and team ids alike) — no auth, CORS is `*`. Anyone with a team link can read that team's usage
- Browser state (sync UUID, joined team ids, budget, last used AIU) lives in `localStorage` (`src/lib/storage.ts`)
