import { useState, type JSX } from "react";
import { BuildStamp } from "@/components/BuildStamp";
import { MemberRow } from "@/components/MemberRow";
import { TeamCumulativeChart } from "@/components/TeamCumulativeChart";
import { useTeamPoll } from "@/hooks/useTeamSync";
import { useWide } from "@/hooks/useWide";
import { leaveTeam } from "@/lib/api";
import { COLORS, offsetColor, todayColor } from "@/lib/constants";
import { countWorkdays, monthKey, parseMonthKey, totalWorkdays } from "@/lib/date";
import {
  enrichMembers,
  sortByBudgetProximity,
  sortByUsage,
  toFlatMembers,
} from "@/lib/members";
import { getSyncUuid, removeTeamId } from "@/lib/storage";
import { backLink, btnSecondary, card, FONT_STACK, pageWrap } from "@/styles";
import type { Uuid } from "@/types";

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

function offsetMonth(key: string, delta: number): string {
  const { year, month } = parseMonthKey(key);
  const d = new Date(year, month - 1 + delta, 1);
  return monthKey(d);
}

/** `/team/:id` — leaderboards for a team's current-month usage. */
export function TeamViewPage({ teamId }: TeamViewPageProps): JSX.Element {
  const [viewMonth, setViewMonth] = useState<string>(() => monthKey());
  const { team, loading, todayLeaderboard } = useTeamPoll(teamId, viewMonth);
  const [leaving, setLeaving] = useState<boolean>(false);
  const wide = useWide(600);
  const currentMonth = monthKey();
  const isCurrentMonth = viewMonth === currentMonth;

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

  const enriched = enrichMembers(toFlatMembers(team.members, viewMonth));
  const byUsage = sortByUsage(enriched);
  const byDailyBudget = sortByBudgetProximity(enriched);
  const enrichedByUuid = new Map(enriched.map((m) => [m.uuid, m]));

  const today = new Date();
  const totalWd = totalWorkdays(today.getFullYear(), today.getMonth());
  const elapsedWd = countWorkdays(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const remainingWd = Math.max(totalWd - elapsedWd, 1);

  const totalAiu = enriched.reduce((sum, member) => sum + member.aiu, 0);
  const maxAiu = Math.max(...enriched.map((member) => member.aiu), 1);
  const totalBudget = enriched.reduce(
    (sum, member) => (member.budget != null ? sum + member.budget : sum),
    0,
  );
  const budgetPct = totalBudget > 0 ? (totalAiu / totalBudget) * 100 : null;
  const expectedPct = totalWd > 0 ? (elapsedWd / totalWd) * 100 : null;
  const burnStatus = budgetPct !== null && expectedPct !== null ? budgetPct - expectedPct : null;
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
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: COLORS.faint }}>
              <button
                onClick={() => setViewMonth((m) => offsetMonth(m, -1))}
                style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.faint, padding: "0 2px", fontSize: "0.8rem", lineHeight: 1 }}
              >
                ‹
              </button>
              <span>
                {enriched.length} member{enriched.length !== 1 ? "s" : ""} ·{" "}
                {new Date(parseMonthKey(viewMonth).year, parseMonthKey(viewMonth).month - 1).toLocaleString("default", { month: "long", year: "numeric" })}
              </span>
              <button
                onClick={() => setViewMonth((m) => offsetMonth(m, 1))}
                disabled={isCurrentMonth}
                style={{ background: "none", border: "none", cursor: isCurrentMonth ? "default" : "pointer", color: isCurrentMonth ? COLORS.faint : COLORS.muted, padding: "0 2px", fontSize: "0.8rem", lineHeight: 1, opacity: isCurrentMonth ? 0.3 : 1 }}
              >
                ›
              </button>
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

        {isCurrentMonth && <div style={{ marginBottom: 16 }}>
          <div style={columnHeading(COLORS.good)}>Top today</div>
          {todayLeaderboard === null ? (
            <div style={{ fontSize: "0.8rem", color: COLORS.faint }}>Loading…</div>
          ) : todayLeaderboard.filter((m) => m.aiu_today > 0).length === 0 ? (
            <div style={{ fontSize: "0.8rem", color: COLORS.faint }}>No activity today</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {todayLeaderboard
                .filter((m) => m.aiu_today > 0)
                .map((m, index) => {
                  const em = enrichedByUuid.get(m.uuid);
                  const remainingBudget =
                    em?.budget != null ? em.budget - em.aiu : null;
                  const allowedToday =
                    remainingBudget != null ? remainingBudget / remainingWd : null;
                  const ratio =
                    allowedToday != null && allowedToday > 0
                      ? m.aiu_today / allowedToday
                      : null;
                  const color = ratio !== null ? todayColor(ratio) : COLORS.primary;
                  return (
                    <div
                      key={m.uuid}
                      style={{
                        background: COLORS.surface,
                        borderRadius: 10,
                        padding: "10px 14px",
                        border: `1px solid ${COLORS.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.65rem",
                            fontWeight: 700,
                            color: "#fff",
                          }}
                        >
                          {index + 1}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{m.name}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "0.88rem", fontWeight: 700, color }}>
                          {m.aiu_today.toFixed(1)} AIU
                        </div>
                        {allowedToday != null && (
                          <div style={{ fontSize: "0.68rem", color: COLORS.faint }}>
                            {allowedToday.toFixed(1)} left/day
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>}

        <div
          style={{
            background: COLORS.surface,
            borderRadius: 10,
            padding: "10px 14px",
            border: `1px solid ${COLORS.border}`,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: "0.78rem", color: COLORS.muted }}>
              Team total this month
            </div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: COLORS.primary }}>
              {totalAiu.toFixed(1)} AIU
            </div>
          </div>
          {budgetPct !== null && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: 4,
              }}
            >
              <div style={{ fontSize: "0.78rem", color: COLORS.muted }}>% of budget used</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <div
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    color:
                      burnStatus === null
                        ? COLORS.muted
                        : burnStatus > 10
                          ? COLORS.bad
                          : burnStatus > 0
                            ? COLORS.warn
                            : COLORS.good,
                  }}
                >
                  {budgetPct.toFixed(1)}%
                </div>
                {burnStatus !== null && (
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color:
                        burnStatus > 10
                          ? COLORS.bad
                          : burnStatus > 0
                            ? COLORS.warn
                            : COLORS.good,
                    }}
                  >
                    {burnStatus > 0 ? "over pace" : "under pace"}
                  </div>
                )}
              </div>
            </div>
          )}
          <TeamCumulativeChart teamId={teamId} month={viewMonth} budget={totalBudget || null} />
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
