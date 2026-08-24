import { useEffect, useState, type JSX } from "react";
import { fetchUsageDays } from "@/lib/api";
import { COLORS } from "@/lib/constants";
import { parseMonthKey } from "@/lib/date";
import type { DailyUsageRecord, MonthKey, Uuid } from "@/types";

export interface DailyUsageChartProps {
  /** Sync UUID whose daily rows should be charted. */
  uuid: Uuid;
  /** Monthly AIU budget, used to draw the per-day allowance line. */
  budget: number | null;
  /** Month to chart, as `YYYY-MM`. */
  month: MonthKey;
}

export interface DailyUsageBarsProps {
  /** Daily rows to chart — already loaded and (optionally) filtered by the caller. */
  days: DailyUsageRecord[];
  /** Monthly AIU budget, used to draw the per-day allowance line. */
  budget: number | null;
  /** Month being charted, as `YYYY-MM`. */
  month: MonthKey;
}

/** Chart geometry in SVG user units. */
const CHART_WIDTH = 280;
const CHART_HEIGHT = 52;
const BAR_GAP = 1.5;

const placeholderStyle = {
  fontSize: "0.68rem",
  color: COLORS.faint,
  textAlign: "center",
  padding: "10px 0",
} as const;

/** Pick a bar colour from how far the day's usage sits above the daily budget. */
function barColor(aiu: number, dailyBudget: number | null, isToday: boolean): string {
  if (isToday) return COLORS.primary;
  if (!aiu) return "#eef0ff";
  if (dailyBudget == null) return COLORS.primary;
  if (aiu > dailyBudget * 1.3) return COLORS.bad;
  if (aiu > dailyBudget * 1.1) return "#c4acf7";
  return COLORS.good;
}

/**
 * Bar chart of AIU per day for one month, with an optional budget guideline.
 * Purely presentational — the caller is responsible for loading `days`.
 */
export function DailyUsageBars({ days, budget, month }: DailyUsageBarsProps): JSX.Element {
  if (days.length === 0) {
    return (
      <div style={placeholderStyle}>
        No daily data yet — sync script v1.2.0+ required
      </div>
    );
  }

  const { year, month: monthNumber } = parseMonthKey(month);
  const totalDays = new Date(year, monthNumber, 0).getDate();
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() + 1 === monthNumber;
  const lastDay = isCurrentMonth ? today.getDate() : totalDays;
  const dailyBudget = budget != null ? budget / totalDays : null;

  // Sum same-day rows (e.g. multiple projects on one day) into a single bar.
  const aiuByDay = new Map<number, number>();
  for (const day of days) {
    const dayOfMonth = new Date(day.date).getDate();
    aiuByDay.set(dayOfMonth, (aiuByDay.get(dayOfMonth) ?? 0) + day.aiu);
  }

  const maxValue = Math.max(...aiuByDay.values(), dailyBudget ?? 0, 1);
  const barWidth = (CHART_WIDTH - BAR_GAP * (lastDay - 1)) / lastDay;
  const budgetY =
    dailyBudget != null ? CHART_HEIGHT - (dailyBudget / maxValue) * CHART_HEIGHT : null;

  return (
    <div>
      <svg
        width="100%"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        style={{ display: "block", overflow: "visible" }}
      >
        {Array.from({ length: lastDay }, (_, index) => {
          const day = index + 1;
          const aiu = aiuByDay.get(day) ?? 0;
          const barHeight = Math.max((aiu / maxValue) * CHART_HEIGHT, aiu > 0 ? 2 : 0);
          const isToday = isCurrentMonth && day === today.getDate();
          return (
            <rect
              key={day}
              x={index * (barWidth + BAR_GAP)}
              y={CHART_HEIGHT - barHeight}
              width={barWidth}
              height={barHeight}
              rx={1.5}
              fill={barColor(aiu, dailyBudget, isToday)}
            >
              <title>{`Day ${day}: ${aiu.toFixed(1)} AIU`}</title>
            </rect>
          );
        })}
        {budgetY !== null && (
          <line
            x1={0}
            y1={budgetY}
            x2={CHART_WIDTH}
            y2={budgetY}
            stroke={COLORS.warn}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.8}
          />
        )}
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.6rem",
          color: "#bbb",
          marginTop: 3,
        }}
      >
        <span>1</span>
        <span style={{ color: COLORS.faint }}>
          {dailyBudget != null ? `— ${dailyBudget.toFixed(0)} AIU/day budget` : "daily AIU"}
        </span>
        <span>{lastDay}</span>
      </div>
    </div>
  );
}

/** Sparkline of daily AIU for one member and month, with a budget guideline. */
export function DailyUsageChart({ uuid, budget, month }: DailyUsageChartProps): JSX.Element {
  const [days, setDays] = useState<DailyUsageRecord[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUsageDays(uuid, month)
      .then((data) => {
        if (!cancelled) setDays(data);
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });
    return () => {
      cancelled = true;
    };
  }, [uuid, month]);

  if (days === null) return <div style={placeholderStyle}>Loading…</div>;

  return (
    <div style={{ marginTop: 10, borderTop: "1px solid #f0f1ff", paddingTop: 10 }}>
      <DailyUsageBars days={days} budget={budget} month={month} />
    </div>
  );
}
