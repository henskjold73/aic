/**
 * Shared domain types for the AIC calendar app.
 *
 * These describe the JSON contract between the `api/` serverless handlers and
 * the React frontend. Both sides import from this file so a change to a
 * response shape breaks the compile on both ends at once.
 */

/** RFC 4122 UUID, as produced by the sync install script. */
export type Uuid = string;

/** Calendar month key in `YYYY-MM` form, e.g. `"2026-08"`. */
export type MonthKey = string;

/** Calendar date key in `YYYY-MM-DD` form. */
export type DateKey = string;

/** ISO-8601 timestamp string, e.g. `"2026-08-13T09:41:00.000Z"`. */
export type IsoTimestamp = string;

/** Who an API call is for: a legacy sync UUID, or `"me"` for the signed-in account. */
export type Subject = Uuid | "me";

/** Month index as used by `Date#getMonth()`: 0 = January … 11 = December. */
export type MonthIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

// ── Usage ─────────────────────────────────────────────────────────

/** One month of aggregated usage for a single user. */
export interface UsageRecord {
  month: MonthKey;
  aiu: number;
  input_tokens: number;
  output_tokens: number;
  /** Monthly AIU budget, or `null` when the user has not set one. */
  budget: number | null;
  /** Semver of the sync script that last wrote this row. */
  script_version: string | null;
  updated_at: IsoTimestamp;
}

/**
 * A row from `/api/usage/[uuid]/history`. Every numeric column is nullable
 * because historical rows may predate a given field.
 */
export interface UsageHistoryRecord {
  month: MonthKey;
  aiu: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  budget: number | null;
  script_version: string | null;
  updated_at: IsoTimestamp;
}

/** One day of usage, optionally attributed to a project. */
export interface DailyUsageRecord {
  date: DateKey;
  aiu: number;
  input_tokens: number;
  output_tokens: number;
  project: string | null;
  synced_at: IsoTimestamp;
}

/** Body accepted by `POST /api/usage/[uuid]`. */
export interface UsagePostBody {
  month?: MonthKey;
  aiu: number;
  input_tokens: number;
  output_tokens: number;
  script_version?: string;
}

/** Body accepted by `POST /api/usage/[uuid]/ping`. */
export interface SyncPingPostBody {
  /** Required unless `request_pair_code` is set. */
  script_version?: string;
  /**
   * SHA-256 hex of the oldest usage event in the machine's Copilot DB. Two sync
   * keys with the same fingerprint read the same data (used for duplicate
   * detection). Absent from scripts older than 1.5.0.
   */
  db_fingerprint?: string;
  /**
   * Ask for a one-time pairing code (installer only). When set, `script_version`
   * may be omitted and nothing is recorded in `sync_meta`.
   */
  request_pair_code?: boolean;
}

/** Response of `POST /api/usage/[uuid]/ping`. */
export interface SyncPingPostResponse {
  ok: true;
  /** Present when a code was requested and the key is not yet on a real account. */
  pair_code?: string;
  /** True when the key already belongs to a signed-in (non-shadow) account. */
  linked?: boolean;
}

/** Response of `GET /api/usage/[uuid]/ping`. */
export interface SyncPingResponse {
  script_version: string;
  last_ping_at: IsoTimestamp;
}

/** Body accepted by `PATCH /api/usage/[uuid]`. */
export interface UsagePatchBody {
  budget?: number | null;
}

/** Body accepted by `POST /api/usage/[uuid]/days`. */
export interface DaysPostBody {
  days: Array<Pick<DailyUsageRecord, "date" | "aiu" | "input_tokens" | "output_tokens">>;
  project?: string | null;
}

// ── Accounts ──────────────────────────────────────────────────────

/** What the UI may show about one of an account's sync keys. The key itself is never returned. */
export interface AccountKeyInfo {
  /** Public handle for this key; used to label, disable or dismiss warnings. */
  id: Uuid;
  /** Last four characters of the key, to tell keys apart. */
  hint: string;
  label: string | null;
  last_ping_at: IsoTimestamp | null;
  disabled: boolean;
}

/** The signed-in account, as returned by `GET /api/me/session`. */
export interface SessionAccount {
  id: Uuid;
  display_name: string | null;
  keys: AccountKeyInfo[];
  /** Problems worth surfacing on every page, e.g. double-counted usage. */
  warnings: AccountWarning[];
}

/** Two of the account's keys appear to read the same Copilot data. */
export interface AccountWarning {
  kind: "duplicate_keys";
  /** Ids of the two keys involved, sorted. */
  key_ids: [Uuid, Uuid];
  /**
   * `same_database`: both scripts report the same DB fingerprint (certain).
   * `matching_days`: several closed days have identical totals (likely).
   */
  reason: "same_database" | "matching_days";
  /** AIU this month counted twice, i.e. the smaller key's total. */
  overstated_aiu: number;
  month: MonthKey;
}

/** One sync key on the Devices page. */
export interface DeviceInfo extends AccountKeyInfo {
  created_at: IsoTimestamp;
  script_version: string | null;
  /** This month's AIU written through this key. */
  aiu_month: number;
}

/** Response of `GET /api/me/devices`. */
export interface DevicesResponse {
  month: MonthKey;
  devices: DeviceInfo[];
  warnings: AccountWarning[];
}

/** Body accepted by `PATCH /api/me/device`. */
export interface DevicePatchBody {
  id: Uuid;
  label?: string | null;
  disabled?: boolean;
}

/** Body accepted by `POST /api/me/pair`. */
export interface PairBody {
  code: string;
}

/** Body accepted by `POST /api/me/dismiss`. */
export interface DismissBody {
  key_ids: [Uuid, Uuid];
}

/** Response of `GET /api/me/session`. `account` is `null` when signed out. */
export interface SessionResponse {
  account: SessionAccount | null;
}

/** Body accepted by `POST /api/me/keys`. */
export interface AttachKeyBody {
  key: Uuid;
}

/** Body accepted by `PATCH /api/me/budget`. */
export interface BudgetPatchBody {
  budget: number;
}

// ── Teams ─────────────────────────────────────────────────────────

/** A team member as returned by `GET /api/team/[id]`. */
export interface TeamMember {
  /** The member's account id — a public handle, never a sync key. */
  id: Uuid;
  name: string;
  joined_at: IsoTimestamp;
  /** `null` when the member has not synced any usage for the current month. */
  usage: UsageRecord | null;
}

/** Response of `GET /api/team/[id]`. */
export interface Team {
  id: Uuid;
  name: string;
  created_at: IsoTimestamp;
  members: TeamMember[];
}

/** Response of `POST /api/team`. */
export interface TeamCreateResponse {
  id: Uuid;
  name: string;
}

/** Body accepted by `POST /api/team`. */
export interface TeamCreateBody {
  name?: string;
}

/** Body accepted by `POST /api/team/[id]/join`. */
export interface TeamJoinBody {
  /** Sync key to join with. Omit when signed in: the account's oldest key is used. */
  uuid?: Uuid;
  name: string;
}

/** Response of `POST /api/team/[id]/join`. */
export interface TeamJoinResponse {
  ok: true;
  team_name: string;
}

/** Minimal team info, as returned by `GET /api/team?uuid=`. */
export interface TeamSummary {
  id: Uuid;
  name: string;
}

/** Response of `GET /api/team?uuid=`. */
export type TeamListResponse = TeamSummary[];

/** Body accepted by `POST /api/team/[id]/leave`. */
export interface TeamLeaveBody {
  /** Sync key to remove. Omit when signed in: every key on the account leaves. */
  uuid?: Uuid;
}

/** One day of AIU usage summed across every member of a team. */
export interface TeamDailyPoint {
  date: DateKey;
  aiu: number;
}

/** Response of `GET /api/team/[id]/days`. */
export type TeamDaysResponse = TeamDailyPoint[];

/** One team member's AIU usage for today, returned by `GET /api/team/[id]/today`. */
export interface TeamTodayMember {
  /** The member's account id. */
  id: Uuid;
  name: string;
  /** AIU consumed today; 0 when no data has been synced yet. */
  aiu_today: number;
}

/** Response of `GET /api/team/[id]/today`. */
export type TeamTodayResponse = TeamTodayMember[];

/** Uniform error envelope returned by every handler on failure. */
export interface ApiError {
  error: string;
}

/** Generic success envelope for write endpoints. */
export interface ApiOk {
  ok: true;
}

/** A response that may be either the happy path or an error envelope. */
export type ApiResult<T> = T | ApiError;

/** Narrows an {@link ApiResult} to its error branch. */
export function isApiError<T extends object>(value: ApiResult<T>): value is ApiError {
  return typeof value === "object" && value !== null && "error" in value;
}

// ── Frontend-derived view models ──────────────────────────────────

/**
 * A team member flattened for rendering: usage fields hoisted to the top
 * level, guaranteed to have a usage record for the month being viewed.
 */
export interface FlatMember {
  id: Uuid;
  name: string;
  joined_at: IsoTimestamp;
  usage: UsageRecord;
  aiu: number;
  budget: number | null;
}

/** A {@link FlatMember} with burn-rate figures computed for the current month. */
export interface EnrichedMember extends FlatMember {
  /** Budget divided across every day of the month, or `null` without a budget. */
  allowedPerDay: number | null;
  /** AIU used so far divided by days elapsed. */
  actualPerDay: number;
  /** `actualPerDay / allowedPerDay`; `null` without a budget. 1 = exactly on pace. */
  ratio: number | null;
}

/** A {@link FlatMember} known to have a budget, so its ratio fields are non-null. */
export interface BudgetedMember extends FlatMember {
  allowedPerDay: number;
  actualPerDay: number;
  ratio: number;
}

/** Burn-rate summary for the signed-in user's own budget. */
export interface AicInsight {
  /** AIU consumed per day so far this month. */
  dailyBurnRate: number;
  /** Month-end total if the current burn rate holds. */
  projected: number;
  /** Budget minus used. Negative when already over. */
  remaining: number;
  /** AIU/day available for the rest of the month to land exactly on budget. */
  allowedDailyFromNow: number;
  overBudget: boolean;
  /** Percentage of budget consumed, 0–100+. */
  pctUsed: number;
  /** Percentage points ahead of (positive) or behind (negative) linear pace. */
  burnStatus: number;
}

/** Status of the browser's connection to the sync backend. */
export type SyncStatus = "ok" | "error" | null;
