import type {
  ApiOk,
  DailyUsageRecord,
  DevicePatchBody,
  DevicesResponse,
  MonthKey,
  SessionResponse,
  Subject,
  SyncPingResponse,
  Team,
  TeamCreateResponse,
  TeamDaysResponse,
  TeamJoinResponse,
  TeamListResponse,
  TeamTodayResponse,
  UsageHistoryRecord,
  UsageRecord,
  Uuid,
} from "@/types";

/** Thrown when an API call returns a non-2xx status. */
export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    let message = response.statusText;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "error" in body) {
        message = String((body as { error: unknown }).error);
      }
    } catch {
      /* non-JSON error body — keep the status text */
    }
    throw new ApiRequestError(response.status, message);
  }
  return (await response.json()) as T;
}

function postJson(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

/** Append a cache-buster so Vercel's edge cache never serves stale usage. */
function noCache(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}t=${Date.now()}`;
}

// ── Account ───────────────────────────────────────────────────────

/** The signed-in account (or `{ account: null }`), derived from the session cookie. */
export function fetchSession(): Promise<SessionResponse> {
  return request<SessionResponse>(noCache("/api/me/session"));
}

/** Attach a sync key to the signed-in account. */
export function attachKey(key: Uuid): Promise<{ ok: true; merged: boolean }> {
  return request<{ ok: true; merged: boolean }>("/api/me/keys", postJson({ key }));
}

/** Redeem a one-time installer code, moving that machine's key onto the account. */
export function pairWithCode(code: string): Promise<ApiOk> {
  return request<ApiOk>("/api/me/pair", postJson({ code }));
}

/** The account's keys with per-key usage, plus any double-counting warnings. */
export function fetchDevices(): Promise<DevicesResponse> {
  return request<DevicesResponse>(noCache("/api/me/devices"));
}

/** Rename, disable or re-enable one key. */
export function patchDevice(patch: DevicePatchBody): Promise<ApiOk> {
  return request<ApiOk>("/api/me/device", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

/** Say two flagged keys really are different machines. */
export function dismissDuplicate(keyIds: [Uuid, Uuid]): Promise<ApiOk> {
  return request<ApiOk>("/api/me/dismiss", postJson({ key_ids: keyIds }));
}

/** End the session. */
export function signOut(): Promise<ApiOk> {
  return request<ApiOk>("/api/me/logout", { method: "POST" });
}

// ── Usage ─────────────────────────────────────────────────────────

/** Path for a usage read: the account endpoint for `"me"`, else the legacy per-key one. */
function usagePath(subject: Subject, me: string, legacy: string): string {
  return subject === "me" ? `/api/me/${me}` : `/api/usage/${subject}${legacy}`;
}

/** Current month's usage. Rejects with 404 when never synced. */
export function fetchUsage(subject: Subject): Promise<UsageRecord> {
  return request<UsageRecord>(noCache(usagePath(subject, "usage", "")));
}

/** Persist the user's monthly budget so team views can use it. */
export function patchBudget(subject: Subject, budget: number): Promise<ApiOk> {
  return request<ApiOk>(usagePath(subject, "budget", ""), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ budget }),
  });
}

/** Every monthly row recorded, newest first. */
export function fetchUsageHistory(subject: Subject): Promise<UsageHistoryRecord[]> {
  return request<UsageHistoryRecord[]>(noCache(usagePath(subject, "history", "/history")));
}

/** Last-seen script version. Rejects with 404 when never pinged. */
export function fetchSyncPing(subject: Subject): Promise<SyncPingResponse> {
  return request<SyncPingResponse>(noCache(usagePath(subject, "ping", "/ping")));
}

/** Daily rows for one month. */
export function fetchUsageDays(
  subject: Subject,
  month: MonthKey,
): Promise<DailyUsageRecord[]> {
  return request<DailyUsageRecord[]>(
    noCache(`${usagePath(subject, "days", "/days")}?month=${month}`),
  );
}

// ── Teams ─────────────────────────────────────────────────────────

/** Create a team and return its generated id. */
export function createTeam(name: string): Promise<TeamCreateResponse> {
  return request<TeamCreateResponse>("/api/team", postJson({ name }));
}

/** Add the current user to a team under a display name. */
export function joinTeam(
  teamId: Uuid,
  subject: Subject,
  name: string,
): Promise<TeamJoinResponse> {
  return request<TeamJoinResponse>(
    `/api/team/${teamId}/join`,
    postJson(subject === "me" ? { name } : { uuid: subject, name }),
  );
}

/** Team metadata plus every member's usage for the given month (defaults to current). */
export function fetchTeam(teamId: Uuid, month?: MonthKey): Promise<Team> {
  const url = month ? `/api/team/${teamId}?month=${month}` : `/api/team/${teamId}`;
  return request<Team>(noCache(url));
}

/** Every team the subject currently belongs to. */
export function fetchMyTeams(subject: Subject): Promise<TeamListResponse> {
  return request<TeamListResponse>(
    noCache(subject === "me" ? "/api/team" : `/api/team?uuid=${subject}`),
  );
}

/** Remove the current user from a team. */
export function leaveTeam(teamId: Uuid, subject: Subject): Promise<ApiOk> {
  return request<ApiOk>(
    `/api/team/${teamId}/leave`,
    postJson(subject === "me" ? {} : { uuid: subject }),
  );
}

/** Daily AIU summed across every member of a team, for one month. */
export function fetchTeamDays(teamId: Uuid, month: MonthKey): Promise<TeamDaysResponse> {
  return request<TeamDaysResponse>(noCache(`/api/team/${teamId}/days?month=${month}`));
}

/** One member's daily AIU for a month, identified by their account id (never a sync key). */
export function fetchTeamMemberDays(
  teamId: Uuid,
  memberId: Uuid,
  month: MonthKey,
): Promise<DailyUsageRecord[]> {
  return request<Array<{ date: string; aiu: number }>>(
    noCache(`/api/team/${teamId}/days?month=${month}&member=${memberId}`),
  ).then((points) =>
    points.map((p) => ({
      date: p.date,
      aiu: p.aiu,
      input_tokens: 0,
      output_tokens: 0,
      project: null,
      synced_at: "",
    })),
  );
}

/** Per-member AIU usage for today, sorted highest first. */
export function fetchTeamToday(teamId: Uuid): Promise<TeamTodayResponse> {
  return request<TeamTodayResponse>(noCache(`/api/team/${teamId}/today`));
}
