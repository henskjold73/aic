import { useEffect, useState, type JSX } from "react";
import { BuildStamp } from "@/components/BuildStamp";
import { MemberRow } from "@/components/MemberRow";
import { useWide } from "@/hooks/useWide";
import { fetchTeam, leaveTeam } from "@/lib/api";
import { COLORS, offsetColor } from "@/lib/constants";
import { monthKey } from "@/lib/date";
import {
  enrichMembers,
  sortByBudgetProximity,
  sortByUsage,
  toFlatMembers,
} from "@/lib/members";
import { getSyncUuid, removeTeamId } from "@/lib/storage";
import { backLink, btnSecondary, card, FONT_STACK, pageWrap } from "@/styles";
import type { Team, Uuid } from "@/types";

export interface TeamViewPageProps {
  /** Team to display, taken from the URL. */
  teamId: Uuid;
}

const columnHeading = (color: string) => ({
  fontSize: "0.7rem",
  fontWeight: 700,
  color,
  textTransform: "uppercase" as const,
  letterSpacing: 0.5,
  marginBottom: 8,
});

/** `/team/:id` — leaderboards for a team's current-month usage. */
export function TeamViewPage({ teamId }: TeamViewPageProps): JSX.Element {
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [leaving, setLeaving] = useState<boolean>(false);
  const wide = useWide(600);
  const currentMonth = monthKey();

  async function leave(): Promise<void> {
    if (!window.confirm(`Leave ${team?.name ?? "this team"}?`)) return;

    setLeaving(true);
    removeTeamId(teamId);
    const uuid = getSyncUuid();
    try {
      if (uuid) await leaveTeam(teamId, uuid);
    } catch {
      /* membership is already removed locally; the server will reconcile later */
    } finally {
      window.location.href = "/";
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchTeam(teamId)
      .then((data) => {
        if (cancelled) return;
        setTeam(data);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (loading) {
    return (
      <div style={{ ...pageWrap, justifyContent: "center" }}>
        <div style={{ color: COLORS.faint, fontSize: "0.9rem" }}>Loading...</div>
      </div>
    );
  }

  if (!team) {
    return (
      <div style={pageWrap}>
        <div style={card}>
          <div style={{ color: COLORS.bad }}>Team not found.</div>
          <a href="/" style={{ ...backLink, display: "block", marginTop: 12 }}>
            Back
          </a>
        </div>
      </div>
    );
  }

  const enriched = enrichMembers(toFlatMembers(team.members, currentMonth));
  const byUsage = sortByUsage(enriched);
  const byDailyBudget = sortByBudgetProximity(enriched);

  const totalAiu = enriched.reduce((sum, member) => sum + member.aiu, 0);
  const maxAiu = Math.max(...enriched.map((member) => member.aiu), 1);
  const joinUrl = `${window.location.origin}/team/${teamId}/join`;

  return (
    <div style={pageWrap}>
      <div
        style={{
          fontFamily: FONT_STACK,
          width: "100%",
          maxWidth: 560,
          color: COLORS.ink,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{team.name}</div>
            <div style={{ fontSize: "0.75rem", color: COLORS.faint }}>
              {enriched.length} member{enriched.length !== 1 ? "s" : ""} ·{" "}
              {new Date().toLocaleString("default", { month: "long", year: "numeric" })}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button
              onClick={() => void leave()}
              disabled={leaving}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: "0.75rem",
                color: COLORS.faint,
                cursor: leaving ? "default" : "pointer",
              }}
            >
              {leaving ? "Leaving…" : "Leave team"}
            </button>
            <a href="/" style={backLink}>
              Back
            </a>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: byDailyBudget.length > 0 && wide ? "1fr 1fr" : "1fr",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div>
            <div style={columnHeading(COLORS.primary)}>Most active</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {byUsage.map((member, index) => (
                <MemberRow
                  key={member.uuid}
                  member={member}
                  rank={index}
                  accent={COLORS.primary}
                  value={`${member.aiu.toFixed(1)} AIU`}
                  maxAiu={maxAiu}
                  month={currentMonth}
                />
              ))}
            </div>
          </div>

          {byDailyBudget.length > 0 && (
            <div>
              <div style={columnHeading(COLORS.warn)}>Closest to daily budget</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {byDailyBudget.map((member, index) => (
                  <MemberRow
                    key={member.uuid}
                    member={member}
                    rank={index}
                    accent={offsetColor(member.ratio)}
                    value={`${member.actualPerDay.toFixed(1)} / ${member.allowedPerDay.toFixed(1)}`}
                    sub="actual / allowed per day"
                    budgetRatio={member.ratio}
                    maxAiu={maxAiu}
                    month={currentMonth}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            background: COLORS.surface,
            borderRadius: 10,
            padding: "10px 14px",
            border: `1px solid ${COLORS.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: "0.78rem", color: COLORS.muted }}>
            Team total this month
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: COLORS.primary }}>
            {totalAiu.toFixed(1)} AIU
          </div>
        </div>

        <div
          style={{
            background: COLORS.page,
            borderRadius: 10,
            padding: "10px 14px",
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ fontSize: "0.7rem", color: COLORS.faint, marginBottom: 4 }}>
            Invite link
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "0.7rem",
                color: "#555",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {joinUrl}
            </div>
            <button
              onClick={() => void navigator.clipboard.writeText(joinUrl)}
              style={btnSecondary}
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      <BuildStamp />
    </div>
  );
}
