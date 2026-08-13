import type {
  ApiOk,
  DailyUsageRecord,
  MonthKey,
  Team,
  TeamCreateResponse,
  TeamDaysResponse,
  TeamJoinResponse,
  TeamListResponse,
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

// ── Usage ─────────────────────────────────────────────────────────

/** Current month's usage for a sync UUID. Rejects with 404 when never synced. */
export function fetchUsage(uuid: Uuid): Promise<UsageRecord> {
  return request<UsageRecord>(noCache(`/api/usage/${uuid}`));
}

/** Persist the user's monthly budget so team views can use it. */
export function patchBudget(uuid: Uuid, budget: number): Promise<ApiOk> {
  return request<ApiOk>(`/api/usage/${uuid}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ budget }),
  });
}

/** Every monthly row recorded for a sync UUID, newest first. */
export function fetchUsageHistory(uuid: Uuid): Promise<UsageHistoryRecord[]> {
  return request<UsageHistoryRecord[]>(`/api/usage/${uuid}/history`);
}

/** Daily rows for one month. */
export function fetchUsageDays(
  uuid: Uuid,
  month: MonthKey,
): Promise<DailyUsageRecord[]> {
  return request<DailyUsageRecord[]>(`/api/usage/${uuid}/days?month=${month}`);
}

// ── Teams ─────────────────────────────────────────────────────────

/** Create a team and return its generated id. */
export function createTeam(name: string): Promise<TeamCreateResponse> {
  return request<TeamCreateResponse>("/api/team", postJson({ name }));
}

/** Add the current user to a team under a display name. */
export function joinTeam(
  teamId: Uuid,
  uuid: Uuid,
  name: string,
): Promise<TeamJoinResponse> {
  return request<TeamJoinResponse>(
    `/api/team/${teamId}/join`,
    postJson({ uuid, name }),
  );
}

/** Team metadata plus every member's current-month usage. */
export function fetchTeam(teamId: Uuid): Promise<Team> {
  return request<Team>(noCache(`/api/team/${teamId}`));
}

/** Every team a sync uuid currently belongs to. */
export function fetchMyTeams(uuid: Uuid): Promise<TeamListResponse> {
  return request<TeamListResponse>(noCache(`/api/team?uuid=${uuid}`));
}

/** Remove the current user from a team. */
export function leaveTeam(teamId: Uuid, uuid: Uuid): Promise<ApiOk> {
  return request<ApiOk>(`/api/team/${teamId}/leave`, postJson({ uuid }));
}

/** Daily AIU summed across every member of a team, for one month. */
export function fetchTeamDays(teamId: Uuid, month: MonthKey): Promise<TeamDaysResponse> {
  return request<TeamDaysResponse>(noCache(`/api/team/${teamId}/days?month=${month}`));
}
