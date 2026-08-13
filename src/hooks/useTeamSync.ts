import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMyTeams, fetchTeam } from "@/lib/api";
import { monthKey } from "@/lib/date";
import { toFlatMembers } from "@/lib/members";
import { addTeamId, getSyncUuid, getTeamIds } from "@/lib/storage";
import type { FlatMember, Team, Uuid } from "@/types";

/** Background refresh interval for the team roster. */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * A member's sync agent runs every 15 minutes; refetch 20 seconds after each
 * member's next expected write so the UI updates as soon as new data lands.
 */
const EXPECTED_SYNC_INTERVAL_MS = (15 * 60 + 20) * 1000;

/**
 * Schedule a targeted refetch for each member whose next expected sync
 * hasn't happened yet, clearing whatever was previously pending first.
 *
 * Shared by {@link useTeamsSync} and {@link useTeamPoll} so both the home
 * page's overview and the full team page stay live the same way.
 */
function scheduleMemberRefetches(
  members: readonly { usage: { updated_at: string } | null }[],
  pendingTimeouts: React.MutableRefObject<number[]>,
  refetch: () => void,
): void {
  for (const id of pendingTimeouts.current) window.clearTimeout(id);
  pendingTimeouts.current = [];

  const now = Date.now();
  for (const member of members) {
    if (!member.usage) continue;
    const elapsed = now - new Date(member.usage.updated_at).getTime();
    const msUntilNextSync = EXPECTED_SYNC_INTERVAL_MS - elapsed;
    if (msUntilNextSync > 0) {
      pendingTimeouts.current.push(window.setTimeout(refetch, msUntilNextSync));
    }
  }
}

/** One joined team, with its current-month roster once loaded. */
export interface TeamSyncEntry {
  id: Uuid;
  name: string;
  /** Members with usage for the current month, or `null` before the first load. */
  members: FlatMember[] | null;
}

export interface TeamsSync {
  /** Every team this browser knows it has joined, in join order. */
  teams: TeamSyncEntry[];
  /** Force an immediate refetch of every joined team. */
  refresh: () => void;
}

/**
 * Poll every team the user has joined and keep each one's current-month
 * roster in state.
 *
 * If a sync UUID is set, this also reconciles the locally remembered team
 * list against the server (covers teams joined from another browser) before
 * fetching rosters.
 *
 * In addition to a fixed poll, this schedules targeted refetches timed to
 * each member's next expected sync so the leaderboards stay close to live.
 */
export function useTeamsSync(): TeamsSync {
  const [teams, setTeams] = useState<TeamSyncEntry[]>([]);
  const pendingTimeouts = useRef<number[]>([]);

  const clearPending = useCallback((): void => {
    for (const id of pendingTimeouts.current) window.clearTimeout(id);
    pendingTimeouts.current = [];
  }, []);

  const refresh = useCallback((): void => {
    const uuid = getSyncUuid();
    const reconciled = uuid
      ? fetchMyTeams(uuid)
          .then((serverTeams) => {
            for (const team of serverTeams) addTeamId(team.id);
          })
          .catch(() => {
            /* server unreachable — fall back to the locally known list */
          })
      : Promise.resolve();

    reconciled.then(() => {
      const ids = getTeamIds();
      if (ids.length === 0) {
        setTeams([]);
        return;
      }

      clearPending();
      const now = Date.now();

      Promise.all(
        ids.map((id) =>
          fetchTeam(id)
            .then((team): TeamSyncEntry => {
              const flat = toFlatMembers(team.members, monthKey());
              for (const member of flat) {
                const elapsed = now - new Date(member.usage.updated_at).getTime();
                const msUntilNextSync = EXPECTED_SYNC_INTERVAL_MS - elapsed;
                if (msUntilNextSync > 0) {
                  pendingTimeouts.current.push(
                    window.setTimeout(() => refresh(), msUntilNextSync),
                  );
                }
              }
              return { id, name: team.name, members: flat };
            })
            .catch(() => null),
        ),
      ).then((results) => {
        setTeams(results.filter((entry): entry is TeamSyncEntry => entry !== null));
      });
    });
  }, [clearPending]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      clearPending();
    };
  }, [refresh, clearPending]);

  return { teams, refresh };
}

export interface TeamPoll {
  /** Team plus every member's current-month usage, or `null` before the first load. */
  team: Team | null;
  /** `true` until the first fetch settles. */
  loading: boolean;
  /** Force an immediate refetch. */
  refresh: () => void;
}

/**
 * Poll a single team's full detail — used by the `/team/:id` page, which
 * (unlike the home page's overview) needs every member's usage, not just the
 * flattened current-month figures.
 *
 * Same live-update strategy as {@link useTeamsSync}: a 5-minute baseline
 * poll, plus a targeted refetch timed to each member's next expected sync.
 */
export function useTeamPoll(teamId: Uuid): TeamPoll {
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const pendingTimeouts = useRef<number[]>([]);

  const clearPending = useCallback((): void => {
    for (const id of pendingTimeouts.current) window.clearTimeout(id);
    pendingTimeouts.current = [];
  }, []);

  const refresh = useCallback((): void => {
    fetchTeam(teamId)
      .then((data) => {
        setTeam(data);
        setLoading(false);
        scheduleMemberRefetches(data.members, pendingTimeouts, refresh);
      })
      .catch(() => {
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(interval);
      clearPending();
    };
  }, [refresh, clearPending]);

  return { team, loading, refresh };
}
