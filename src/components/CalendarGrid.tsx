import type { JSX } from "react";
import { COLORS } from "@/lib/constants";
import { isWeekend, WEEKDAY_LABELS } from "@/lib/date";

export interface CalendarGridProps {
  year: number;
  /** Zero-based month index, matching `Date#getMonth()`. */
  month: number;
  /** Number of calendar days in the month. */
  totalDays: number;
  /** True when the displayed month is the real current month. */
  isCurrentMonth: boolean;
  /** Reference "now" used to highlight today. */
  today: Date;
  /** Monthly AIU budget, or `null` when unset. */
  budget: number | null;
  /** AIU consumed per day so far, or `null` without an insight. */
  dailyBurnRate: number | null;
  /** Renders larger day cells and the target-percentage caption. */
  wide: boolean;
}

/** A calendar cell: a day number, or `null` for leading blanks. */
type Cell = number | null;

/**
 * If `day` falls on a Saturday or Sunday, roll it forward to the following
 * Monday. No usage accrues over the weekend, so the "run out" marker should
 * never land there.
 */
function snapPastWeekend(year: number, month: number, day: number): number {
  let snapped = day;
  while (isWeekend(year, month, snapped)) snapped += 1;
  return snapped;
}

function buildCells(year: number, month: number, totalDays: number): Cell[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  // Convert Sunday-first (0–6) to Monday-first leading blanks.
  const startOffset = firstWeekday === 0 ? 6 : firstWeekday - 1;

  const cells: Cell[] = Array.from({ length: startOffset }, () => null);
  for (let day = 1; day <= totalDays; day++) cells.push(day);
  return cells;
}

/**
 * Month grid showing, per weekday, the linear target percentage of budget and
 * the projected percentage at the current burn rate, plus a "run out" marker.
 */
export function CalendarGrid({
  year,
  month,
  totalDays,
  isCurrentMonth,
  today,
  budget,
  dailyBurnRate,
  wide,
}: CalendarGridProps): JSX.Element {
  const cells = buildCells(year, month, totalDays);

  const showBurn =
    isCurrentMonth && budget !== null && budget > 0 && dailyBurnRate !== null;
  const runOutDay =
    showBurn && dailyBurnRate > 0
      ? snapPastWeekend(year, month, Math.ceil(budget / dailyBurnRate))
      : null;

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7,1fr)",
          gap: 3,
          marginBottom: 4,
        }}
      >
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={label}
            style={{
              textAlign: "center",
              fontSize: "0.68rem",
              fontWeight: 600,
              color: index >= 5 ? "#ccc" : COLORS.faint,
              textTransform: "uppercase",
              padding: "2px 0",
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
        {cells.map((day, index) => {
          if (day === null) return <div key={`blank-${index}`} />;

          const weekend = isWeekend(year, month, day);
          const isToday = isCurrentMonth && day === today.getDate();
          const isRunOut =
            runOutDay !== null && day === runOutDay && runOutDay <= totalDays;

          let background = weekend ? "#fafafa" : "#f7f8ff";
          let border = weekend ? "1px solid #f0f0f0" : `1px solid ${COLORS.border}`;
          let numberColor = weekend ? "#bbb" : "#222";

          if (isRunOut && !isToday) {
            background = "#fff5f5";
            border = `2px solid ${COLORS.bad}`;
          }
          if (isToday) {
            background = COLORS.primary;
            border = `1px solid ${COLORS.primary}`;
            numberColor = "#fff";
          }

          // Where a linear spend would put you by this day.
          const targetPct = (day / totalDays) * 100;
          // Where the current burn rate will put you by this day.
          const actualPct = showBurn ? ((dailyBurnRate * day) / budget) * 100 : null;

          const targetLabel = wide && !weekend ? `${targetPct.toFixed(0)}%` : null;
          const actualLabel =
            actualPct !== null && !weekend
              ? `${Math.min(actualPct, 999).toFixed(0)}%`
              : null;

          const actualColor = isToday
            ? "#fff"
            : actualPct === null
              ? undefined
              : actualPct > targetPct + 5
                ? COLORS.bad
                : actualPct < targetPct - 5
                  ? COLORS.good
                  : COLORS.primary;

          return (
            <div
              key={day}
              style={{
                background,
                border,
                borderRadius: wide ? 9 : 7,
                minHeight: wide ? 60 : 56,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: wide ? 1 : 2,
                padding: "4px 2px",
              }}
            >
              <div
                style={{
                  fontSize: wide ? "0.82rem" : "0.9rem",
                  fontWeight: 700,
                  color: numberColor,
                  lineHeight: 1,
                }}
              >
                {day}
              </div>
              {targetLabel && (
                <div
                  style={{
                    fontSize: "0.58rem",
                    fontWeight: 500,
                    color: isToday ? "rgba(255,255,255,0.7)" : COLORS.faint,
                    lineHeight: 1,
                  }}
                >
                  {targetLabel}
                </div>
              )}
              {actualLabel && (
                <div
                  style={{
                    fontSize: wide ? "0.62rem" : "0.68rem",
                    fontWeight: 700,
                    color: actualColor,
                    lineHeight: 1,
                  }}
                >
                  {actualLabel}
                </div>
              )}
              {isRunOut && !isToday && (
                <div
                  style={{
                    fontSize: "0.55rem",
                    color: COLORS.bad,
                    fontWeight: 700,
                    lineHeight: 1,
                  }}
                >
                  out
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
