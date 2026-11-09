import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  activeKeys,
  ensureSchema,
  int,
  iso,
  num,
  query,
  sql,
  dateKey,
  type DbRow,
  type PgNumeric,
  type PgTimestamp,
} from "../db";
import { errorMessage, fail, isUuid, parseBody, queryParam } from "../http";
import {
  attachKeyToAccount,
  computeWarnings,
  dismissWarning,
  redeemPairingCode,
} from "../_accounts";
import {
  appOrigin,
  beginOAuthState,
  endSession,
  finishOAuthState,
  requireAccount,
  safeNextPath,
  sessionAccountId,
  startSession,
} from "../_auth";
import type {
  AccountKeyInfo,
  AttachKeyBody,
  BudgetPatchBody,
  DailyUsageRecord,
  DeviceInfo,
  DevicePatchBody,
  DevicesResponse,
  DismissBody,
  PairBody,
  SessionResponse,
  SyncPingResponse,
  UsageHistoryRecord,
  UsageRecord,
} from "../../src/types";

/**
 * `/api/me/[action]` — everything that is scoped to the signed-in account.
 *
 * One function dispatches all actions so the project stays under Vercel's
 * per-deployment function limit.
 *
 * | action    | method | purpose                                              |
 * |-----------|--------|------------------------------------------------------|
 * | login     | GET    | redirect to GitHub                                   |
 * | callback  | GET    | finish GitHub OAuth, set the session cookie          |
 * | logout    | POST   | clear the session cookie                             |
 * | session   | GET    | the signed-in account and its keys, or `null`        |
 * | keys      | POST   | attach a sync key (UUID) to the account              |
 * | pair      | POST   | attach the key behind a one-time installer code      |
 * | devices   | GET    | the account's keys with per-key usage and warnings   |
 * | device    | PATCH  | rename, disable or re-enable a key                   |
 * | dismiss   | POST   | "these two keys are different machines"              |
 * | usage     | GET    | current month, summed across the account's keys      |
 * | history   | GET    | every month, summed across the account's keys        |
 * | days      | GET    | daily rows for `?month=`, summed across keys         |
 * | ping      | GET    | oldest script version / latest ping across keys      |
 * | budget    | PATCH  | set the current month's budget                       |
 *
 * These routes are same-origin only: no CORS headers, and responses are
 * `no-store` because they depend on the cookie.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  res.setHeader("Cache-Control", "private, no-store");
  const action = queryParam(req, "action");

  try {
    await ensureSchema();
    switch (action) {
      case "login":
        return method(req, res, "GET") ? login(req, res) : undefined;
      case "callback":
        return method(req, res, "GET") ? await callback(req, res) : undefined;
      case "logout":
        return method(req, res, "POST") ? logout(req, res) : undefined;
      case "session":
        return method(req, res, "GET") ? await session(req, res) : undefined;
      case "keys":
        return method(req, res, "POST") ? await attachKey(req, res) : undefined;
      case "pair":
        return method(req, res, "POST") ? await pair(req, res) : undefined;
      case "devices":
        return method(req, res, "GET") ? await devices(req, res) : undefined;
      case "device":
        return method(req, res, "PATCH") ? await patchDevice(req, res) : undefined;
      case "dismiss":
        return method(req, res, "POST") ? await dismiss(req, res) : undefined;
      case "usage":
        return method(req, res, "GET") ? await usage(req, res) : undefined;
      case "history":
        return method(req, res, "GET") ? await history(req, res) : undefined;
      case "days":
        return method(req, res, "GET") ? await days(req, res) : undefined;
      case "ping":
        return method(req, res, "GET") ? await ping(req, res) : undefined;
      case "budget":
        return method(req, res, "PATCH") ? await patchBudget(req, res) : undefined;
      default:
        return fail(res, 404, "unknown action");
    }
  } catch (err: unknown) {
    fail(res, 500, errorMessage(err));
  }
}

function method(req: VercelRequest, res: VercelResponse, expected: string): boolean {
  if (req.method === expected) return true;
  fail(res, 405, "method not allowed");
  return false;
}

const currentMonth = (): string => new Date().toISOString().slice(0, 7);

// ── Login ─────────────────────────────────────────────────────────

function login(req: VercelRequest, res: VercelResponse): void {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) return fail(res, 500, "GITHUB_CLIENT_ID is not set");

  const next = safeNextPath(queryParam(req, "next"));
  const state = beginOAuthState(req, res, next);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appOrigin(req)}/api/me/callback`,
    state,
  });
  res.redirect(302, `https://github.com/login/oauth/authorize?${params.toString()}`);
}

interface GithubUser {
  id: number;
  login: string;
}

async function callback(req: VercelRequest, res: VercelResponse): Promise<void> {
  const next = finishOAuthState(req, res, queryParam(req, "state"));
  if (next === null) return fail(res, 400, "invalid oauth state");

  const code = queryParam(req, "code");
  if (!code) return fail(res, 400, "missing code");

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail(res, 500, "GitHub OAuth is not configured");

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: `${appOrigin(req)}/api/me/callback`,
    }),
  });
  const tokenBody = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenBody.access_token) return fail(res, 400, "GitHub sign-in failed");

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenBody.access_token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "aic-calendar",
    },
  });
  if (!userResponse.ok) return fail(res, 400, "could not read GitHub profile");
  const user = (await userResponse.json()) as GithubUser;
  if (typeof user.id !== "number") return fail(res, 400, "could not read GitHub profile");

  // Only the GitHub id is trusted as identity; the login name is just a label.
  const rows = await query<{ id: string }>`
    INSERT INTO accounts (id, github_id, display_name)
    VALUES (gen_random_uuid(), ${user.id}, ${user.login})
    ON CONFLICT (github_id) DO UPDATE SET
      display_name = COALESCE(accounts.display_name, EXCLUDED.display_name)
    RETURNING id
  `;
  const account = rows[0];
  if (!account) return fail(res, 500, "could not create account");

  startSession(req, res, account.id);
  res.redirect(302, next);
}

function logout(req: VercelRequest, res: VercelResponse): void {
  endSession(req, res);
  res.status(200).json({ ok: true });
}

// ── Session ───────────────────────────────────────────────────────

interface KeyRow extends DbRow {
  id: string;
  key: string;
  label: string | null;
  last_ping_at: PgTimestamp;
  disabled_at: PgTimestamp;
}

async function session(req: VercelRequest, res: VercelResponse): Promise<void> {
  const accountId = sessionAccountId(req);
  if (!accountId) {
    const signedOut: SessionResponse = { account: null };
    return void res.status(200).json(signedOut);
  }

  const accounts = await query<{ id: string; display_name: string | null }>`
    SELECT id, display_name FROM accounts WHERE id = ${accountId} LIMIT 1
  `;
  const account = accounts[0];
  if (!account) {
    // The account was deleted (e.g. merged away) — treat the cookie as stale.
    endSession(req, res);
    const signedOut: SessionResponse = { account: null };
    return void res.status(200).json(signedOut);
  }

  const keyRows = await query<KeyRow>`
    SELECT id, key, label, last_ping_at, disabled_at
    FROM sync_keys WHERE account_id = ${accountId} ORDER BY created_at ASC
  `;
  const keys: AccountKeyInfo[] = keyRows.map((k) => ({
    id: k.id,
    hint: k.key.slice(-4),
    label: k.label,
    last_ping_at: iso(k.last_ping_at),
    disabled: k.disabled_at !== null,
  }));

  const payload: SessionResponse = {
    account: {
      id: account.id,
      display_name: account.display_name,
      keys,
      warnings: await computeWarnings(accountId, currentMonth()),
    },
  };
  res.status(200).json(payload);
}

// ── Attach a key ──────────────────────────────────────────────────

/**
 * Attach a sync key to the signed-in account. Knowing the key is the proof of
 * ownership; see {@link attachKeyToAccount} for the shadow-account merge rules.
 */
async function attachKey(req: VercelRequest, res: VercelResponse): Promise<void> {
  const accountId = requireAccount(req, res);
  if (!accountId) return;

  const body = parseBody<AttachKeyBody>(req);
  if (!body || !isUuid(body.key)) return fail(res, 400, "invalid key");

  const result = await attachKeyToAccount(accountId, body.key.toLowerCase());
  if (result === "taken") return fail(res, 409, "key belongs to another account");
  res.status(200).json({ ok: true, merged: result === "merged" });
}

/** Attach the key behind a one-time code shown by the installer. */
async function pair(req: VercelRequest, res: VercelResponse): Promise<void> {
  const accountId = requireAccount(req, res);
  if (!accountId) return;

  const body = parseBody<PairBody>(req);
  if (!body || typeof body.code !== "string") return fail(res, 400, "code required");

  const outcome = await redeemPairingCode(accountId, body.code);
  if (outcome.status === "throttled") return fail(res, 429, "too many wrong codes — wait a few minutes");
  if (outcome.status === "invalid") return fail(res, 404, "invalid or expired code");
  if (outcome.result === "taken") return fail(res, 409, "that machine is linked to another account");
  res.status(200).json({ ok: true });
}

// ── Devices ───────────────────────────────────────────────────────

interface DeviceRow extends DbRow {
  id: string;
  key: string;
  label: string | null;
  created_at: PgTimestamp;
  last_ping_at: PgTimestamp;
  disabled_at: PgTimestamp;
  script_version: string | null;
  aiu_month: PgNumeric;
}

async function devices(req: VercelRequest, res: VercelResponse): Promise<void> {
  const accountId = requireAccount(req, res);
  if (!accountId) return;
  const month = currentMonth();

  const rows = await query<DeviceRow>`
    SELECT k.id, k.key, k.label, k.created_at, k.last_ping_at, k.disabled_at,
           sm.script_version, COALESCE(u.aiu, 0) AS aiu_month
    FROM sync_keys k
    LEFT JOIN sync_meta sm ON sm.user_uuid = k.key
    LEFT JOIN usage u ON u.user_uuid = k.key AND u.month = ${month}
    WHERE k.account_id = ${accountId}
    ORDER BY k.created_at ASC
  `;
  const list: DeviceInfo[] = rows.map((r) => ({
    id: r.id,
    hint: r.key.slice(-4),
    label: r.label,
    last_ping_at: iso(r.last_ping_at),
    disabled: r.disabled_at !== null,
    created_at: iso(r.created_at) ?? "",
    script_version: r.script_version,
    aiu_month: num(r.aiu_month) ?? 0,
  }));
  const payload: DevicesResponse = {
    month,
    devices: list,
    warnings: await computeWarnings(accountId, month),
  };
  res.status(200).json(payload);
}

const MAX_LABEL_LENGTH = 40;

async function patchDevice(req: VercelRequest, res: VercelResponse): Promise<void> {
  const accountId = requireAccount(req, res);
  if (!accountId) return;

  const body = parseBody<DevicePatchBody>(req);
  if (!body || !isUuid(body.id)) return fail(res, 400, "invalid id");

  if (body.label !== undefined) {
    const label = body.label === null ? null : body.label.trim().slice(0, MAX_LABEL_LENGTH) || null;
    await sql`UPDATE sync_keys SET label = ${label} WHERE id = ${body.id} AND account_id = ${accountId}`;
  }
  if (body.disabled !== undefined) {
    // Disabling only hides the key's data from totals; the script keeps writing
    // and nothing is deleted, so it is fully reversible.
    await sql`
      UPDATE sync_keys SET disabled_at = ${body.disabled ? new Date().toISOString() : null}
      WHERE id = ${body.id} AND account_id = ${accountId}
    `;
  }
  res.status(200).json({ ok: true });
}

async function dismiss(req: VercelRequest, res: VercelResponse): Promise<void> {
  const accountId = requireAccount(req, res);
  if (!accountId) return;

  const body = parseBody<DismissBody>(req);
  const ids = body?.key_ids;
  if (!Array.isArray(ids) || ids.length !== 2 || !isUuid(ids[0]) || !isUuid(ids[1])) {
    return fail(res, 400, "two key ids required");
  }
  const ok = await dismissWarning(accountId, ids[0], ids[1]);
  if (!ok) return fail(res, 404, "key not found");
  res.status(200).json({ ok: true });
}

// ── Reads ─────────────────────────────────────────────────────────

interface UsageSumRow extends DbRow {
  month: string;
  aiu: PgNumeric;
  input_tokens: PgNumeric;
  output_tokens: PgNumeric;
  script_version: string | null;
  updated_at: PgTimestamp;
  /** Budget set through the account (`account_budgets`). */
  account_budget: PgNumeric;
  /** Budget written by the pre-account API onto individual key rows. */
  legacy_budget: PgNumeric;
}

function toHistoryRecord(r: UsageSumRow): UsageHistoryRecord {
  return {
    month: r.month,
    aiu: num(r.aiu),
    input_tokens: int(r.input_tokens),
    output_tokens: int(r.output_tokens),
    budget: num(r.account_budget) ?? num(r.legacy_budget),
    script_version: r.script_version,
    updated_at: iso(r.updated_at) ?? "",
  };
}

async function usage(req: VercelRequest, res: VercelResponse): Promise<void> {
  const accountId = requireAccount(req, res);
  if (!accountId) return;
  const month = currentMonth();

  const rows = await query<UsageSumRow>`
    SELECT
      u.month,
      SUM(u.aiu) AS aiu,
      SUM(u.input_tokens) AS input_tokens,
      SUM(u.output_tokens) AS output_tokens,
      (ARRAY_AGG(u.script_version ORDER BY u.updated_at DESC))[1] AS script_version,
      MAX(u.updated_at) AS updated_at,
      MAX(ab.budget) AS account_budget,
      MAX(u.budget) AS legacy_budget
    FROM usage u
    JOIN sync_keys k ON k.key = u.user_uuid
    LEFT JOIN account_budgets ab ON ab.account_id = k.account_id AND ab.month = u.month
    WHERE k.account_id = ${accountId} AND k.disabled_at IS NULL AND u.month = ${month}
    GROUP BY u.month
  `;
  const row = rows[0];
  if (!row) return fail(res, 404, "not found");

  const h = toHistoryRecord(row);
  const record: UsageRecord = {
    month: h.month,
    aiu: h.aiu ?? 0,
    input_tokens: h.input_tokens ?? 0,
    output_tokens: h.output_tokens ?? 0,
    budget: h.budget,
    script_version: h.script_version,
    updated_at: h.updated_at || new Date().toISOString(),
  };
  res.status(200).json(record);
}

async function history(req: VercelRequest, res: VercelResponse): Promise<void> {
  const accountId = requireAccount(req, res);
  if (!accountId) return;

  const rows = await query<UsageSumRow>`
    SELECT
      u.month,
      SUM(u.aiu) AS aiu,
      SUM(u.input_tokens) AS input_tokens,
      SUM(u.output_tokens) AS output_tokens,
      (ARRAY_AGG(u.script_version ORDER BY u.updated_at DESC))[1] AS script_version,
      MAX(u.updated_at) AS updated_at,
      MAX(ab.budget) AS account_budget,
      MAX(u.budget) AS legacy_budget
    FROM usage u
    JOIN sync_keys k ON k.key = u.user_uuid
    LEFT JOIN account_budgets ab ON ab.account_id = k.account_id AND ab.month = u.month
    WHERE k.account_id = ${accountId} AND k.disabled_at IS NULL
    GROUP BY u.month
    ORDER BY u.month DESC
  `;
  res.status(200).json(rows.map(toHistoryRecord));
}

interface DaySumRow extends DbRow {
  date: PgTimestamp;
  project: string | null;
  aiu: PgNumeric;
  input_tokens: PgNumeric;
  output_tokens: PgNumeric;
  synced_at: PgTimestamp;
}

async function days(req: VercelRequest, res: VercelResponse): Promise<void> {
  const accountId = requireAccount(req, res);
  if (!accountId) return;
  const month = queryParam(req, "month") ?? currentMonth();

  const rows = await query<DaySumRow>`
    SELECT
      ud.date,
      ud.project,
      SUM(ud.aiu) AS aiu,
      SUM(ud.input_tokens) AS input_tokens,
      SUM(ud.output_tokens) AS output_tokens,
      MAX(ud.synced_at) AS synced_at
    FROM usage_daily ud
    JOIN sync_keys k ON k.key = ud.user_uuid
    WHERE k.account_id = ${accountId} AND k.disabled_at IS NULL
      AND TO_CHAR(ud.date, 'YYYY-MM') = ${month}
    GROUP BY ud.date, ud.project
    ORDER BY ud.date ASC
  `;
  const records: DailyUsageRecord[] = rows.map((r) => ({
    date: dateKey(r.date) ?? "",
    aiu: num(r.aiu) ?? 0,
    input_tokens: int(r.input_tokens) ?? 0,
    output_tokens: int(r.output_tokens) ?? 0,
    project: r.project,
    synced_at: iso(r.synced_at) ?? "",
  }));
  res.status(200).json(records);
}

/** Compare dotted version strings numerically; negative when `a < b`. */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function ping(req: VercelRequest, res: VercelResponse): Promise<void> {
  const accountId = requireAccount(req, res);
  if (!accountId) return;

  const rows = await query<{ script_version: string; last_ping_at: PgTimestamp }>`
    SELECT sm.script_version, sm.last_ping_at
    FROM sync_meta sm JOIN sync_keys k ON k.key = sm.user_uuid
    WHERE k.account_id = ${accountId} AND k.disabled_at IS NULL
  `;
  if (rows.length === 0) return fail(res, 404, "no ping recorded");

  // Report the *oldest* script so the UI nags if any machine is out of date.
  const oldest = rows.reduce((a, b) => (compareVersions(a.script_version, b.script_version) <= 0 ? a : b));
  const latestPing = rows
    .map((r) => iso(r.last_ping_at) ?? "")
    .reduce((a, b) => (a > b ? a : b));
  const payload: SyncPingResponse = { script_version: oldest.script_version, last_ping_at: latestPing };
  res.status(200).json(payload);
}

// ── Budget ────────────────────────────────────────────────────────

async function patchBudget(req: VercelRequest, res: VercelResponse): Promise<void> {
  const accountId = requireAccount(req, res);
  if (!accountId) return;

  const body = parseBody<BudgetPatchBody>(req);
  if (!body || typeof body.budget !== "number" || !Number.isFinite(body.budget) || body.budget < 0) {
    return fail(res, 400, "invalid budget");
  }
  const month = currentMonth();

  // Team views read `account_budgets` first. The value is also mirrored onto each
  // key's `usage.budget` only so a rollback to the key-only code still sees it.
  const keys = await activeKeys(accountId);
  await sql.transaction([
    sql`
      INSERT INTO account_budgets (account_id, month, budget)
      VALUES (${accountId}, ${month}, ${body.budget})
      ON CONFLICT (account_id, month) DO UPDATE SET budget = EXCLUDED.budget
    `,
    ...keys.map(
      (key) => sql`
        INSERT INTO usage (user_uuid, month, budget)
        VALUES (${key}, ${month}, ${body.budget})
        ON CONFLICT (user_uuid, month) DO UPDATE SET budget = EXCLUDED.budget
      `,
    ),
  ]);
  res.status(200).json({ ok: true });
}
