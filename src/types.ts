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

/** Body accepted by `PATCH /api/usage/[uuid]`. */
export interface UsagePatchBody {
  budget?: number | null;
}

/** Body accepted by `POST /api/usage/[uuid]/days`. */
export interface DaysPostBody {
  days: Array<Pick<DailyUsageRecord, "date" | "aiu" | "input_tokens" | "output_tokens">>;
  project?: string | null;
}

// ── Teams ─────────────────────────────────────────────────────────

/** A team member as returned by `GET /api/team/[id]`. */
export interface TeamMember {
  uuid: Uuid;
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
  uuid: Uuid;
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
  uuid: Uuid;
}

/** One day of AIU usage summed across every member of a team. */
export interface TeamDailyPoint {
  date: DateKey;
  aiu: number;
}

/** Response of `GET /api/team/[id]/days`. */
export type TeamDaysResponse = TeamDailyPoint[];

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
  uuid: Uuid;
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
