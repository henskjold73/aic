# AIC Calendar

Track your GitHub Copilot AI Credit (AIU) usage against your monthly budget — with a live calendar, burn rate projection, and team leaderboards.

**Live at [aic-jade.vercel.app](https://aic-jade.vercel.app)**

---

## What it does

- **Calendar view** — each day shows your target % and projected actual % based on current burn rate
- **Run-out day** — the day you'll exceed your budget is marked with a red border
- **Auto-sync** — a background script reads your local Copilot SQLite DB every 15 minutes and pushes usage to Vercel Blob
- **Team view** — see your team's usage ranked by most active and closest to daily budget

---

## Deploy your own

1. Fork this repo and push to GitHub
2. Create a project on [vercel.com](https://vercel.com) and import the repo
3. In Vercel → Storage, create a **Blob store** (choose Public) and connect it to your project
4. Deploy — Vercel auto-detects Vite

---

## Set up auto-sync

The sync script reads `~/.copilot/session-store.db` (written by Copilot CLI) and POSTs your monthly AIU total to your Vercel deployment every 15 minutes.

**macOS / Linux**
```bash
bash <(curl -sL https://raw.githubusercontent.com/henskjold73/aic/main/scripts/install-sync.sh)
```

**Windows (PowerShell)**
```powershell
irm https://raw.githubusercontent.com/henskjold73/aic/main/scripts/install-sync.ps1 | iex
```

The script prints a UUID — paste it at `/auto` on your deployment to link your local usage to the app.

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
npm run dev
```

Requires a `.env.local` with your Vercel Blob token:
```
BLOB_READ_WRITE_TOKEN=...
```

---

## How it works

- Copilot CLI writes session data to `~/.copilot/session-store.db` (SQLite)
- The sync script queries the `assistant_usage_events` table for the current month's total `total_nano_aiu`, converts to AIU, and POSTs to `/api/usage/{uuid}`
- The API route merges the payload with any existing blob data (preserving budget and other fields)
- The frontend polls `/api/usage/{uuid}` every 5 minutes and updates the calendar in real time
- Team data is fetched from `/api/team/{id}` which aggregates all members' usage blobs in parallel
- UUIDs act as unguessable tokens — no auth required
