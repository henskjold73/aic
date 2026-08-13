import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTeam } from "@/lib/api";
import { monthKey } from "@/lib/date";
import { toFlatMembers } from "@/lib/members";
import { getTeamId } from "@/lib/storage";
import type { FlatMember } from "@/types";

/** Background refresh interval for the team roster. */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * A member's sync agent runs every 15 minutes; refetch 20 seconds after each
 * member's next expected write so the UI updates as soon as new data lands.
 */
const EXPECTED_SYNC_INTERVAL_MS = (15 * 60 + 20) * 1000;

export interface TeamSync {
  /** Members with usage for the current month, or `null` before the first load. */
  members: FlatMember[] | null;
  /** Force an immediate refetch. */
  refresh: () => void;
}

/**
 * Poll the user's team and keep its current-month members in state.
 *
 * In addition to a fixed poll, this schedules targeted refetches timed to each
 * member's next expected sync so the leaderboard stays close to live.
 */
export function useTeamSync(): TeamSync {
  const [members, setMembers] = useState<FlatMember[] | null>(null);
  const pendingTimeouts = useRef<number[]>([]);

  const clearPending = useCallback((): void => {
    for (const id of pendingTimeouts.current) window.clearTimeout(id);
    pendingTimeouts.current = [];
  }, []);

  const refresh = useCallback((): void => {
    const teamId = getTeamId();
    if (!teamId) return;

    fetchTeam(teamId)
      .then((team) => {
        const flat = toFlatMembers(team.members, monthKey());
        setMembers(flat);

        clearPending();
        const now = Date.now();
        for (const member of flat) {
          const elapsed = now - new Date(member.usage.updated_at).getTime();
          const msUntilNextSync = EXPECTED_SYNC_INTERVAL_MS - elapsed;
          if (msUntilNextSync > 0) {
            pendingTimeouts.current.push(
              window.setTimeout(() => refresh(), msUntilNextSync),
            );
          }
        }
      })
      .catch(() => {
        /* team unavailable — keep showing the last known roster */
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

  return { members, refresh };
}
