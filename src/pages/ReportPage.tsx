import { useEffect, useMemo, useState, type CSSProperties, type JSX } from "react";
import { useWide } from "@/hooks/useWide";
import { fetchUsageDays, fetchUsageHistory } from "@/lib/api";
import { COLORS } from "@/lib/constants";
import { monthKey } from "@/lib/date";
import { getSyncUuid } from "@/lib/storage";
import { backLink, btnPrimary, btnSecondary, card, pageWrap, FONT_STACK } from "@/styles";
import type { DailyUsageRecord, MonthKey, UsageHistoryRecord } from "@/types";

/** Sentinel for "no project filter applied". */
const ALL_PROJECTS = "all" as const;
type ProjectFilter = typeof ALL_PROJECTS | string;

const th: CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 700,
  color: COLORS.primary,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  padding: "6px 10px",
  textAlign: "left",
  borderBottom: `2px solid ${COLORS.border}`,
};
const thRight: CSSProperties = { ...th, textAlign: "right" };
const td: CSSProperties = {
  fontSize: "0.8rem",
  color: "#333",
  padding: "7px 10px",
  borderBottom: "1px solid #f0f1ff",
};
const tdRight: CSSProperties = {
  ...td,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};
const emptyState: CSSProperties = {
  padding: 20,
  fontSize: "0.8rem",
  color: COLORS.faint,
  textAlign: "center",
};
const sectionCard: CSSProperties = {
  background: COLORS.surface,
  borderRadius: 12,
  border: `1px solid ${COLORS.border}`,
  overflow: "hidden",
};

/** Trigger a client-side CSV download without touching the network. */
function downloadCsv(filename: string, header: string, rows: readonly string[]): void {
  const csv = [header, ...rows].join("\n");
  const anchor = document.createElement("a");
  anchor.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  anchor.download = filename;
  anchor.click();
}

/** Percentage-of-budget colour: green under 80%, amber to 100%, red beyond. */
function percentColor(pct: number | null): string {
  if (pct === null) return COLORS.faint;
  if (pct > 100) return COLORS.bad;
  if (pct > 80) return COLORS.warn;
  return COLORS.good;
}

/** `/report` — monthly history table plus a per-day breakdown for one month. */
export function ReportPage(): JSX.Element {
  const uuid = getSyncUuid();
  const wide = useWide(520);

  const [history, setHistory] = useState<UsageHistoryRecord[] | null>(null);
  const [days, setDays] = useState<DailyUsageRecord[] | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>(() => monthKey());
  const [selectedProject, setSelectedProject] = useState<ProjectFilter>(ALL_PROJECTS);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!uuid) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchUsageHistory(uuid)
      .then((data) => {
        if (cancelled) return;
        setHistory(data);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uuid]);

  useEffect(() => {
    if (!uuid) return;
    let cancelled = false;
    fetchUsageDays(uuid, selectedMonth)
      .then((data) => {
        if (!cancelled) setDays(data);
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });
    return () => {
      cancelled = true;
    };
  }, [uuid, selectedMonth]);

  const projects = useMemo<string[]>(() => {
    if (!days) return [];
    const unique = new Set<string>();
    for (const day of days) {
      if (day.project) unique.add(day.project);
    }
    return [...unique];
  }, [days]);

  const filteredDays = useMemo<DailyUsageRecord[]>(() => {
    if (!days) return [];
    if (selectedProject === ALL_PROJECTS) return days;
    return days.filter((day) => day.project === selectedProject);
  }, [days, selectedProject]);

  function exportHistoryCsv(): void {
    if (!history?.length) return;
    downloadCsv(
      `aic-history-${uuid?.slice(0, 8) ?? "export"}.csv`,
      "month,aiu,input_tokens,output_tokens,budget",
      history.map((row) =>
        [
          row.month,
          row.aiu ?? "",
          row.input_tokens ?? "",
          row.output_tokens ?? "",
          row.budget ?? "",
        ].join(","),
      ),
    );
  }

  function exportDailyCsv(): void {
    if (!filteredDays.length) return;
    downloadCsv(
      `aic-daily-${selectedMonth}-${uuid?.slice(0, 8) ?? "export"}.csv`,
      "date,aiu,input_tokens,output_tokens,project",
      filteredDays.map((row) =>
        [row.date, row.aiu, row.input_tokens, row.output_tokens, row.project ?? ""].join(
          ",",
        ),
      ),
    );
  }

  if (!uuid) {
    return (
      <div style={pageWrap}>
        <div style={card}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>No sync UUID found</div>
          <div style={{ fontSize: "0.8rem", color: COLORS.muted, marginBottom: 16 }}>
            Set up auto-sync first to see your report.
          </div>
          <a
            href="/"
            style={{
              ...btnPrimary,
              display: "block",
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            Back
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <div
        style={{ fontFamily: FONT_STACK, width: "100%", maxWidth: 640, color: COLORS.ink }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>Usage Report</div>
          <a href="/" style={backLink}>
            ← Back
          </a>
        </div>

        {/* Monthly history */}
        <div style={{ ...sectionCard, marginBottom: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderBottom: "1px solid #f0f1ff",
            }}
          >
            <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>Monthly History</div>
            <button
              onClick={exportHistoryCsv}
              style={{ ...btnSecondary, fontSize: "0.72rem" }}
            >
              Export CSV
            </button>
          </div>

          {loading ? (
            <div style={emptyState}>Loading...</div>
          ) : !history?.length ? (
            <div style={emptyState}>
              No history yet — sync script will populate this over time.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: wide ? "unset" : 340,
                }}
              >
                <thead>
                  <tr>
                    <th style={th}>Month</th>
                    <th style={thRight}>AIU</th>
                    {wide && <th style={thRight}>Input</th>}
                    {wide && <th style={thRight}>Output</th>}
                    <th style={thRight}>Budget</th>
                    <th style={thRight}>% Used</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => {
                    const pct =
                      row.budget && row.aiu ? (row.aiu / row.budget) * 100 : null;
                    return (
                      <tr
                        key={row.month}
                        style={{
                          cursor: "pointer",
                          background:
                            row.month === selectedMonth ? COLORS.page : "transparent",
                        }}
                        onClick={() => setSelectedMonth(row.month)}
                      >
                        <td style={td}>{row.month}</td>
                        <td style={tdRight}>{row.aiu?.toFixed(1) ?? "—"}</td>
                        {wide && (
                          <td style={tdRight}>
                            {row.input_tokens?.toLocaleString() ?? "—"}
                          </td>
                        )}
                        {wide && (
                          <td style={tdRight}>
                            {row.output_tokens?.toLocaleString() ?? "—"}
                          </td>
                        )}
                        <td style={tdRight}>{row.budget?.toFixed(0) ?? "—"}</td>
                        <td
                          style={{
                            ...tdRight,
                            fontWeight: 700,
                            color: percentColor(pct),
                          }}
                        >
                          {pct === null ? "—" : `${pct.toFixed(0)}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Daily breakdown */}
        <div style={sectionCard}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderBottom: "1px solid #f0f1ff",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <div style={{ fontSize: "0.85rem", fontWeight: 700 }}>
              Daily — {selectedMonth}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {projects.length > 0 && (
                <select
                  value={selectedProject}
                  onChange={(event) => setSelectedProject(event.target.value)}
                  style={{
                    fontSize: "0.75rem",
                    border: "1px solid #dde0f5",
                    borderRadius: 6,
                    padding: "4px 8px",
                    background: "#f7f8ff",
                    color: "#333",
                  }}
                >
                  <option value={ALL_PROJECTS}>All projects</option>
                  {projects.map((project) => (
                    <option key={project} value={project}>
                      {project}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={exportDailyCsv}
                style={{ ...btnSecondary, fontSize: "0.72rem" }}
              >
                Export CSV
              </button>
            </div>
          </div>

          {!days ? (
            <div style={emptyState}>Loading...</div>
          ) : !filteredDays.length ? (
            <div style={emptyState}>
              No daily data for {selectedMonth}. Update your sync script to v1.2.0 to start
              collecting daily data.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Date</th>
                    <th style={thRight}>AIU</th>
                    {wide && <th style={thRight}>Input</th>}
                    {wide && <th style={thRight}>Output</th>}
                    {projects.length > 0 && <th style={th}>Project</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredDays.map((row) => (
                    <tr key={row.date}>
                      <td style={td}>{row.date.slice(0, 10)}</td>
                      <td style={tdRight}>{row.aiu.toFixed(2)}</td>
                      {wide && <td style={tdRight}>{row.input_tokens.toLocaleString()}</td>}
                      {wide && (
                        <td style={tdRight}>{row.output_tokens.toLocaleString()}</td>
                      )}
                      {projects.length > 0 && <td style={td}>{row.project ?? "—"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
