import { useState, useMemo, useEffect, useCallback } from "react";
import { inject } from "@vercel/analytics";
inject();

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isWeekend(year, month, day) {
  const d = new Date(year, month, day).getDay();
  return d === 0 || d === 6;
}

function countWorkdays(year, month, upToDay) {
  let count = 0;
  for (let d = 1; d <= upToDay; d++) {
    if (!isWeekend(year, month, d)) count++;
  }
  return count;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function timeAgo(iso) {
  const sec = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function totalWorkdays(year, month) {
  return countWorkdays(year, month, daysInMonth(year, month));
}

// ── Team components ──────────────────────────────────────────────

function TeamCreate() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [teamId, setTeamId] = useState(null);

  async function create() {
    setLoading(true);
    const r = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || "My Team" }),
    });
    const data = await r.json();
    setTeamId(data.id);
    setLoading(false);
    localStorage.setItem("aic_team_id", data.id);
  }

  const joinUrl = teamId ? `${window.location.origin}/team/${teamId}/join` : null;

  return (
    <div style={pageWrap}>
      <div style={card}>
        <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6 }}>Create a team</div>
        <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 16 }}>Share the join link with your coworkers — everyone adds their sync UUID to the team.</div>
        {!teamId ? (
          <>
            <label style={{ fontSize: "0.75rem", color: "#666", display: "block", marginBottom: 12 }}>
              Team name
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Platform team" style={{ ...inputStyle, marginTop: 4 }} />
            </label>
            <button onClick={create} disabled={loading} style={btnPrimary}>{loading ? "Creating..." : "Create team"}</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: 6 }}>Join link — share this:</div>
            <div style={{ background: "#f4f5fb", borderRadius: 8, padding: "10px 12px", fontFamily: "monospace", fontSize: "0.75rem", color: "#333", wordBreak: "break-all", marginBottom: 12 }}>{joinUrl}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => navigator.clipboard.writeText(joinUrl)} style={btnSecondary}>Copy link</button>
              <button onClick={() => window.location.href = `/team/${teamId}`} style={btnPrimary}>View team</button>
            </div>
          </>
        )}
        <div style={{ marginTop: 12 }}>
          <a href="/" style={{ fontSize: "0.75rem", color: "#aaa" }}>Back</a>
        </div>
      </div>
    </div>
  );
}

function TeamJoin({ teamId }) {
  const [name, setName] = useState("");
  const [uuid, setUuid] = useState(localStorage.getItem("aic_sync_uuid") ?? "");
  const [status, setStatus] = useState(null);
  const [teamName, setTeamName] = useState("");

  async function join() {
    if (!UUID_RE.test(uuid.trim())) { setStatus("bad_uuid"); return; }
    if (!name.trim()) { setStatus("bad_name"); return; }
    const r = await fetch(`/api/team/${teamId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uuid: uuid.trim(), name: name.trim() }),
    });
    const data = await r.json();
    if (data.ok) {
      setTeamName(data.team_name);
      setStatus("joined");
      localStorage.setItem("aic_sync_uuid", uuid.trim());
      localStorage.setItem("aic_team_id", teamId);
    } else {
      setStatus("error");
    }
  }

  if (status === "joined") return (
    <div style={pageWrap}>
      <div style={card}>
        <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 8 }}>Joined {teamName}!</div>
        <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 16 }}>Your usage will appear in the team view as soon as your sync script runs.</div>
        <button onClick={() => window.location.href = `/team/${teamId}`} style={btnPrimary}>View team</button>
      </div>
    </div>
  );

  const isWin = navigator.userAgent.includes("Windows");
  const installCmd = isWin
    ? `irm https://raw.githubusercontent.com/henskjold73/aic/main/scripts/install-sync.ps1 | iex`
    : `bash <(curl -sL https://raw.githubusercontent.com/henskjold73/aic/main/scripts/install-sync.sh)`;

  return (
    <div style={pageWrap}>
      <div style={card}>
        <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 6 }}>Join team</div>
        <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 16 }}>
          First, install the sync script to get your UUID. Then enter your name and paste the UUID below.
        </div>

        <div style={{ fontSize: "0.7rem", color: "#aaa", marginBottom: 4 }}>1. Run in your terminal</div>
        <div style={{ background: "#f4f5fb", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontFamily: "monospace", fontSize: "0.72rem", color: "#555", wordBreak: "break-all" }}>
          {installCmd}
        </div>

        <div style={{ fontSize: "0.7rem", color: "#aaa", marginBottom: 4 }}>2. Enter your details</div>
        <label style={{ fontSize: "0.75rem", color: "#666", display: "block", marginBottom: 10 }}>
          Your name
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morgan" style={{ ...inputStyle, marginTop: 4 }} />
        </label>
        <label style={{ fontSize: "0.75rem", color: "#666", display: "block", marginBottom: 12 }}>
          Sync UUID <span style={{ color: "#aaa", fontWeight: 400 }}>(printed by the install script)</span>
          <input value={uuid} onChange={e => setUuid(e.target.value)} placeholder="xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx" style={{ ...inputStyle, marginTop: 4, fontFamily: "monospace", fontSize: "0.8rem" }} />
        </label>
        {status === "bad_uuid" && <div style={{ fontSize: "0.75rem", color: "#e05252", marginBottom: 8 }}>Invalid UUID — run the install script to get yours.</div>}
        {status === "bad_name" && <div style={{ fontSize: "0.75rem", color: "#e05252", marginBottom: 8 }}>Please enter your name.</div>}
        {status === "error" && <div style={{ fontSize: "0.75rem", color: "#e05252", marginBottom: 8 }}>Something went wrong — check the team link is correct.</div>}
        <button onClick={join} style={btnPrimary}>Join team</button>
        <div style={{ marginTop: 12 }}>
          <a href="/" style={{ fontSize: "0.75rem", color: "#aaa" }}>Back</a>
        </div>
      </div>
    </div>
  );
}

function TeamView({ teamId }) {
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    fetch(`/api/team/${teamId}?t=${Date.now()}`)
      .then(r => r.json())
      .then(data => { setTeam(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [teamId]);

  if (loading) return <div style={{ ...pageWrap, justifyContent: "center" }}><div style={{ color: "#aaa", fontSize: "0.9rem" }}>Loading...</div></div>;
  if (!team || team.error) return <div style={pageWrap}><div style={card}><div style={{ color: "#e05252" }}>Team not found.</div><a href="/" style={{ fontSize: "0.75rem", color: "#aaa", display: "block", marginTop: 12 }}>Back</a></div></div>;

  const today = new Date();
  const dayOfMonth = today.getDate();
  const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  const enriched = team.members
    .filter(m => m.usage?.month === currentMonth)
    .map(m => {
      const aiu = m.usage.aiu;
      const budget = m.usage.budget ?? null;
      const allowedPerDay = budget ? budget / totalDays : null;
      const actualPerDay = dayOfMonth > 0 ? aiu / dayOfMonth : 0;
      const ratio = allowedPerDay ? actualPerDay / allowedPerDay : null;
      return { ...m, aiu, budget, allowedPerDay, actualPerDay, ratio };
    });

  const byUsage = [...enriched].sort((a, b) => b.aiu - a.aiu);
  const byDailyBudget = [...enriched].filter(m => m.ratio != null).sort((a, b) => Math.abs(a.actualPerDay - a.allowedPerDay) - Math.abs(b.actualPerDay - b.allowedPerDay));

  const totalAIU = enriched.reduce((s, m) => s + m.aiu, 0);
  const maxAIU = Math.max(...enriched.map(m => m.aiu), 1);
  const joinUrl = `${window.location.origin}/team/${teamId}/join`;

  function MemberRow({ m, i, accent, value, sub, budgetRatio }) {
    let bar;
    if (budgetRatio != null) {
      // Bar: 0 = no usage (-100% off), 50% = on budget (0% off), 100% = 2x budget (+100% off)
      const pct = Math.min((budgetRatio / 2) * 100, 100);
      const barColor = offsetColor(budgetRatio);
      bar = (
        <div style={{ position: "relative", background: "#eef0ff", borderRadius: 6, height: 6, overflow: "visible" }}>
          {/* -30% threshold at 35% */}
          <div style={{ position: "absolute", left: "35%", top: -1, width: 2, height: 8, background: "#e05252", borderRadius: 1, zIndex: 1, opacity: 0.4 }} />
          {/* -10% threshold at 45% */}
          <div style={{ position: "absolute", left: "45%", top: -1, width: 2, height: 8, background: "#4f6ef7", borderRadius: 1, zIndex: 1, opacity: 0.4 }} />
          {/* on budget (0% off) at 50% */}
          <div style={{ position: "absolute", left: "50%", top: -1, width: 2, height: 8, background: "#3ab87a", borderRadius: 1, zIndex: 1, opacity: 0.6 }} />
          {/* +10% threshold at 55% */}
          <div style={{ position: "absolute", left: "55%", top: -1, width: 2, height: 8, background: "#4f6ef7", borderRadius: 1, zIndex: 1, opacity: 0.4 }} />
          {/* +30% threshold at 65% */}
          <div style={{ position: "absolute", left: "65%", top: -1, width: 2, height: 8, background: "#e05252", borderRadius: 1, zIndex: 1, opacity: 0.4 }} />
          <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 6, transition: "width 0.3s" }} />
        </div>
      );
    } else {
      bar = (
        <div style={{ background: "#eef0ff", borderRadius: 6, height: 5, overflow: "hidden" }}>
          <div style={{ width: `${(m.aiu / maxAIU) * 100}%`, height: "100%", background: `linear-gradient(90deg,${accent},${accent}99)`, borderRadius: 6 }} />
        </div>
      );
    }

    return (
      <div style={{ background: "#fff", borderRadius: 10, padding: "12px 14px", border: "1px solid #e8eaff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700, color: "#fff" }}>{i + 1}</div>
            <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{m.name}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: accent }}>{value}</div>
            {sub && <div style={{ fontSize: "0.65rem", color: "#aaa" }}>{sub}</div>}
          </div>
        </div>
        {bar}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <div style={{ fontSize: "0.65rem", color: "#aaa" }}>synced {timeAgo(m.usage.updated_at)}</div>
          {budgetRatio != null ? (() => { const off = Math.round((budgetRatio - 1) * 100); const abs = Math.abs(off); const color = abs <= 10 ? "#3ab87a" : abs <= 30 ? "#4f6ef7" : "#e05252"; return <div style={{ fontSize: "0.65rem", color }}>{off > 0 ? "+" : ""}{off}% off</div>; })() : null}
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", width: "100%", maxWidth: 560, color: "#1a1a2e" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{team.name}</div>
            <div style={{ fontSize: "0.75rem", color: "#aaa" }}>{enriched.length} member{enriched.length !== 1 ? "s" : ""} · {new Date().toLocaleString("default", { month: "long", year: "numeric" })}</div>
          </div>
          <a href="/" style={{ fontSize: "0.75rem", color: "#aaa", textDecoration: "none" }}>Back</a>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: byDailyBudget.length ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 16 }}>
          {/* Most active */}
          <div>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#4f6ef7", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Most active</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {byUsage.map((m, i) => (
                <MemberRow key={m.uuid} m={m} i={i} accent="#4f6ef7"
                  value={`${m.aiu.toFixed(1)} AIU`} />
              ))}
            </div>
          </div>

          {/* Closest to daily budget */}
          {byDailyBudget.length > 0 && (
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#e0953a", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Closest to daily budget</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {byDailyBudget.map((m, i) => (
                  <MemberRow key={m.uuid} m={m} i={i}
                    accent={offsetColor(m.ratio)}
                    value={`${m.actualPerDay.toFixed(1)} / ${m.allowedPerDay.toFixed(1)}`}
                    sub="actual / allowed per day"
                    budgetRatio={m.ratio} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Total */}
        <div style={{ background: "#fff", borderRadius: 10, padding: "10px 14px", border: "1px solid #e8eaff", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: "0.78rem", color: "#666" }}>Team total this month</div>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#4f6ef7" }}>{totalAIU.toFixed(1)} AIU</div>
        </div>

        {/* Invite */}
        <div style={{ background: "#f4f5fb", borderRadius: 10, padding: "10px 14px", border: "1px solid #e8eaff" }}>
          <div style={{ fontSize: "0.7rem", color: "#aaa", marginBottom: 4 }}>Invite link</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "#555", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{joinUrl}</div>
            <button onClick={() => navigator.clipboard.writeText(joinUrl)} style={btnSecondary}>Copy</button>
          </div>
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 8, right: 10, fontSize: "0.6rem", color: "#999", fontFamily: "monospace", pointerEvents: "none" }}>
        {__BUILD_HASH__} · {new Date(__BUILD_TIME__).toLocaleString()}
      </div>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────
function offsetColor(ratio) {
  const abs = Math.abs(Math.round((ratio - 1) * 100));
  return abs <= 10 ? "#3ab87a" : abs <= 30 ? "#4f6ef7" : "#e05252";
}

// ── Styles ────────────────────────────────────────────────────────
const pageWrap = { minHeight: "100vh", background: "#f4f5fb", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px" };
const card = { background: "#fff", borderRadius: 14, padding: "28px 24px", width: "100%", maxWidth: 420, boxShadow: "0 8px 40px rgba(79,110,247,0.1)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" };
const btnPrimary = { padding: "8px 18px", background: "#4f6ef7", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", width: "100%" };
const btnSecondary = { padding: "6px 12px", background: "#eef0ff", color: "#4f6ef7", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.78rem", cursor: "pointer" };

// ── Team side panels ──────────────────────────────────────────────
function TeamSidePanels({ members, today }) {
  const [wide, setWide] = useState(window.innerWidth >= 900);
  useEffect(() => {
    const handler = () => setWide(window.innerWidth >= 900);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const dayOfMonth = today.getDate();
  const topUser = [...members].sort((a, b) => b.aiu - a.aiu)[0];

  const closestToBudget = [...members]
    .filter(m => m.budget)
    .map(m => {
      const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const allowedPerDay = m.budget / totalDays;
      const actualPerDay = dayOfMonth > 0 ? m.aiu / dayOfMonth : 0;
      const ratio = allowedPerDay > 0 ? actualPerDay / allowedPerDay : 0;
      return { ...m, allowedPerDay, actualPerDay, ratio };
    })
    .sort((a, b) => Math.abs(a.actualPerDay - a.allowedPerDay) - Math.abs(b.actualPerDay - b.allowedPerDay))[0];

  const budgetColor = closestToBudget ? offsetColor(closestToBudget.ratio) : "#4f6ef7";
  const teamId = localStorage.getItem("aic_team_id");

  const panelBase = {
    background: "#fff", borderRadius: 10, padding: "12px 14px",
    border: "1px solid #e8eaff", display: "flex", flexDirection: "column",
    alignItems: "center", textAlign: "center", fontSize: "0.72rem", color: "#666",
  };

  const leftContent = (
    <>
      <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "#4f6ef7", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Most active</div>
      <div style={{ fontWeight: 700, color: "#1a1a2e", fontSize: "0.85rem", marginBottom: 2 }}>{topUser.name}</div>
      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#4f6ef7" }}>{topUser.aiu.toFixed(1)}</div>
      <div style={{ color: "#aaa" }}>AIU this month</div>
      <a href={`/team/${teamId}`} style={{ display: "block", marginTop: 8, fontSize: "0.65rem", color: "#4f6ef7", textDecoration: "none", fontWeight: 600 }}>View team →</a>
    </>
  );

  const rightContent = closestToBudget && (
    <>
      <div style={{ fontSize: "0.65rem", fontWeight: 700, color: budgetColor, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Daily budget</div>
      <div style={{ fontWeight: 700, color: "#1a1a2e", fontSize: "0.85rem", marginBottom: 2 }}>{closestToBudget.name}</div>
      <div style={{ fontSize: "1.1rem", fontWeight: 700, color: budgetColor }}>{closestToBudget.actualPerDay.toFixed(1)}</div>
      <div style={{ color: "#aaa" }}>AIU/day actual</div>
      <div style={{ marginTop: 4, color: "#bbb", fontSize: "0.65rem" }}>budget {closestToBudget.allowedPerDay.toFixed(1)}/day</div>
    </>
  );

  if (wide) return (
    <>
      <div style={{ ...panelBase, position: "fixed", top: "50%", transform: "translateY(-50%)", width: 148, left: "calc((100vw - 480px) / 2 - 164px)" }}>{leftContent}</div>
      {closestToBudget && <div style={{ ...panelBase, position: "fixed", top: "50%", transform: "translateY(-50%)", width: 148, right: "calc((100vw - 480px) / 2 - 164px)" }}>{rightContent}</div>}
    </>
  );

  return (
    <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
      <div style={{ ...panelBase, flex: 1 }}>{leftContent}</div>
      {closestToBudget && <div style={{ ...panelBase, flex: 1 }}>{rightContent}</div>}
    </div>
  );
}

// ── Auto modal ────────────────────────────────────────────────────
function AutoModal({ onClose }) {
  const [input, setInput] = useState(localStorage.getItem("aic_sync_uuid") ?? "");
  const [status, setStatus] = useState(null);

  function save() {
    const val = input.trim();
    if (!UUID_RE.test(val)) { setStatus("error"); return; }
    localStorage.setItem("aic_sync_uuid", val);
    setStatus("saved");
    setTimeout(() => { window.location.href = "/"; }, 800);
  }

  function clear() {
    localStorage.removeItem("aic_sync_uuid");
    setInput("");
    setStatus(null);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,20,40,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "28px 24px", width: "100%", maxWidth: 420, boxShadow: "0 8px 40px rgba(79,110,247,0.15)" }}>
        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1a1a2e", marginBottom: 6 }}>Connect auto-sync</div>
        <div style={{ fontSize: "0.8rem", color: "#666", marginBottom: 20, lineHeight: 1.5 }}>
          Run the install script to get your sync UUID, then paste it below. Your Copilot usage will update automatically every 15 minutes.
        </div>

        {(() => {
          const isWin = navigator.userAgent.includes("Windows");
          const install = isWin
            ? `irm https://raw.githubusercontent.com/henskjold73/aic/main/scripts/install-sync.ps1 | iex`
            : `bash <(curl -sL https://raw.githubusercontent.com/henskjold73/aic/main/scripts/install-sync.sh)`;
          const uninstall = isWin
            ? `irm https://raw.githubusercontent.com/henskjold73/aic/main/scripts/uninstall-sync.ps1 | iex`
            : `bash <(curl -sL https://raw.githubusercontent.com/henskjold73/aic/main/scripts/uninstall-sync.sh)`;
          return (
            <>
              <div style={{ fontSize: "0.7rem", color: "#aaa", marginBottom: 4 }}>Install</div>
              <div style={{ background: "#f4f5fb", borderRadius: 8, padding: "10px 12px", marginBottom: 10, fontFamily: "monospace", fontSize: "0.72rem", color: "#555", wordBreak: "break-all" }}>
                {install}
              </div>
              <div style={{ fontSize: "0.7rem", color: "#aaa", marginBottom: 4 }}>Uninstall</div>
              <div style={{ background: "#f4f5fb", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontFamily: "monospace", fontSize: "0.72rem", color: "#555", wordBreak: "break-all" }}>
                {uninstall}
              </div>
            </>
          );
        })()}

        <label style={{ fontSize: "0.75rem", color: "#666", display: "block", marginBottom: 12 }}>
          Sync UUID
          <input
            value={input}
            onChange={e => { setInput(e.target.value); setStatus(null); }}
            placeholder="xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx"
            style={{ ...inputStyle, marginTop: 4, fontFamily: "monospace", fontSize: "0.82rem" }}
          />
        </label>

        {status === "error" && <div style={{ fontSize: "0.75rem", color: "#e05252", marginBottom: 10 }}>Invalid UUID — check the value from the install script.</div>}
        {status === "saved" && <div style={{ fontSize: "0.75rem", color: "#3ab87a", marginBottom: 10 }}>Saved! Redirecting…</div>}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={save} style={{ flex: 1, padding: "8px 0", background: "#4f6ef7", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
            Save
          </button>
          {localStorage.getItem("aic_sync_uuid") && (
            <button onClick={clear} style={{ padding: "8px 14px", background: "#fee", color: "#e05252", border: "1px solid #fcc", borderRadius: 8, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
              Remove
            </button>
          )}
          <button onClick={onClose} style={{ padding: "8px 14px", background: "#eef0ff", color: "#555", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.85rem", cursor: "pointer" }}>
            Cancel
          </button>
        </div>
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <a href="/privacy" style={{ fontSize: "0.7rem", color: "#aaa", textDecoration: "none" }}>What does this install on my computer?</a>
        </div>
      </div>
    </div>
  );
}

// ── Report page ───────────────────────────────────────────────────
function ReportPage() {
  const uuid = localStorage.getItem('aic_sync_uuid');
  const [history, setHistory] = useState(null);
  const [days, setDays] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedProject, setSelectedProject] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uuid) { setLoading(false); return; }
    fetch(`/api/usage/${uuid}/history`)
      .then(r => r.json())
      .then(data => { setHistory(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [uuid]);

  useEffect(() => {
    if (!uuid) return;
    fetch(`/api/usage/${uuid}/days?month=${selectedMonth}`)
      .then(r => r.json())
      .then(data => setDays(Array.isArray(data) ? data : []))
      .catch(() => setDays([]));
  }, [uuid, selectedMonth]);

  const projects = useMemo(() => {
    if (!days) return [];
    const set = new Set(days.map(d => d.project).filter(Boolean));
    return [...set];
  }, [days]);

  const filteredDays = useMemo(() => {
    if (!days) return [];
    if (selectedProject === 'all') return days;
    return days.filter(d => d.project === selectedProject);
  }, [days, selectedProject]);

  function exportCSV() {
    if (!history) return;
    const monthRows = history.map(r =>
      [r.month, r.aiu ?? '', r.input_tokens ?? '', r.output_tokens ?? '', r.budget ?? ''].join(',')
    );
    const csv = ['month,aiu,input_tokens,output_tokens,budget', ...monthRows].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `aic-history-${uuid?.slice(0, 8)}.csv`;
    a.click();
  }

  function exportDailyCSV() {
    if (!filteredDays.length) return;
    const rows = filteredDays.map(r =>
      [r.date, r.aiu ?? '', r.input_tokens ?? '', r.output_tokens ?? '', r.project ?? ''].join(',')
    );
    const csv = ['date,aiu,input_tokens,output_tokens,project', ...rows].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `aic-daily-${selectedMonth}-${uuid?.slice(0, 8)}.csv`;
    a.click();
  }

  const th = { fontSize: '0.7rem', fontWeight: 700, color: '#4f6ef7', textTransform: 'uppercase', letterSpacing: 0.5, padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #e8eaff' };
  const td = { fontSize: '0.8rem', color: '#333', padding: '7px 10px', borderBottom: '1px solid #f0f1ff' };
  const tdR = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

  if (!uuid) return (
    <div style={pageWrap}>
      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>No sync UUID found</div>
        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 16 }}>Set up auto-sync first to see your report.</div>
        <a href="/" style={{ ...btnPrimary, display: 'block', textAlign: 'center', textDecoration: 'none' }}>Back</a>
      </div>
    </div>
  );

  return (
    <div style={pageWrap}>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", width: '100%', maxWidth: 640, color: '#1a1a2e' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>Usage Report</div>
          <a href="/" style={{ fontSize: '0.75rem', color: '#aaa', textDecoration: 'none' }}>← Back</a>
        </div>

        {/* Monthly history */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8eaff', marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #f0f1ff' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Monthly History</div>
            <button onClick={exportCSV} style={{ ...btnSecondary, fontSize: '0.72rem' }}>Export CSV</button>
          </div>
          {loading ? (
            <div style={{ padding: '20px', fontSize: '0.8rem', color: '#aaa', textAlign: 'center' }}>Loading...</div>
          ) : !history?.length ? (
            <div style={{ padding: '20px', fontSize: '0.8rem', color: '#aaa', textAlign: 'center' }}>No history yet — sync script will populate this over time.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Month</th>
                  <th style={{ ...th, textAlign: 'right' }}>AIU</th>
                  <th style={{ ...th, textAlign: 'right' }}>Input</th>
                  <th style={{ ...th, textAlign: 'right' }}>Output</th>
                  <th style={{ ...th, textAlign: 'right' }}>Budget</th>
                  <th style={{ ...th, textAlign: 'right' }}>% Used</th>
                </tr>
              </thead>
              <tbody>
                {history.map(r => {
                  const pct = r.budget && r.aiu ? ((r.aiu / r.budget) * 100).toFixed(0) : null;
                  const pctColor = !pct ? '#aaa' : pct > 100 ? '#e05252' : pct > 80 ? '#e0953a' : '#3ab87a';
                  return (
                    <tr key={r.month} style={{ cursor: 'pointer', background: r.month === selectedMonth ? '#f4f5fb' : 'transparent' }}
                      onClick={() => setSelectedMonth(r.month)}>
                      <td style={td}>{r.month}</td>
                      <td style={tdR}>{r.aiu?.toFixed(1) ?? '—'}</td>
                      <td style={tdR}>{r.input_tokens?.toLocaleString() ?? '—'}</td>
                      <td style={tdR}>{r.output_tokens?.toLocaleString() ?? '—'}</td>
                      <td style={tdR}>{r.budget?.toFixed(0) ?? '—'}</td>
                      <td style={{ ...tdR, fontWeight: 700, color: pctColor }}>{pct ? `${pct}%` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Daily breakdown */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e8eaff', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #f0f1ff', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Daily — {selectedMonth}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {projects.length > 0 && (
                <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
                  style={{ fontSize: '0.75rem', border: '1px solid #dde0f5', borderRadius: 6, padding: '4px 8px', background: '#f7f8ff', color: '#333' }}>
                  <option value="all">All projects</option>
                  {projects.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
              <button onClick={exportDailyCSV} style={{ ...btnSecondary, fontSize: '0.72rem' }}>Export CSV</button>
            </div>
          </div>
          {!days ? (
            <div style={{ padding: '20px', fontSize: '0.8rem', color: '#aaa', textAlign: 'center' }}>Loading...</div>
          ) : !filteredDays.length ? (
            <div style={{ padding: '20px', fontSize: '0.8rem', color: '#aaa', textAlign: 'center' }}>No daily data for {selectedMonth}. Update your sync script to v1.1.0 to start collecting daily data.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={{ ...th, textAlign: 'right' }}>AIU</th>
                  <th style={{ ...th, textAlign: 'right' }}>Input</th>
                  <th style={{ ...th, textAlign: 'right' }}>Output</th>
                  {projects.length > 0 && <th style={th}>Project</th>}
                </tr>
              </thead>
              <tbody>
                {filteredDays.map(r => (
                  <tr key={r.date}>
                    <td style={td}>{typeof r.date === 'string' ? r.date.slice(0, 10) : new Date(r.date).toISOString().slice(0, 10)}</td>
                    <td style={tdR}>{r.aiu?.toFixed(2) ?? '—'}</td>
                    <td style={tdR}>{r.input_tokens?.toLocaleString() ?? '—'}</td>
                    <td style={tdR}>{r.output_tokens?.toLocaleString() ?? '—'}</td>
                    {projects.length > 0 && <td style={td}>{r.project ?? '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Privacy / What's installed page ──────────────────────────────
function PrivacyPage() {
  const isWin = navigator.userAgent.includes("Windows");
  const mono = { fontFamily: "monospace", fontSize: "0.78rem", background: "#f4f5fb", borderRadius: 6, padding: "8px 10px", color: "#444", wordBreak: "break-all", marginBottom: 4 };
  const h2 = { fontSize: "0.85rem", fontWeight: 700, color: "#1a1a2e", margin: "20px 0 6px" };
  const p = { fontSize: "0.82rem", color: "#555", lineHeight: 1.6, margin: "0 0 8px" };

  return (
    <div style={pageWrap}>
      <div style={{ ...card, maxWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>What's on your computer</div>
          <a href="/" style={{ fontSize: "0.75rem", color: "#aaa", textDecoration: "none" }}>Back</a>
        </div>

        <p style={p}>The sync script installs a background job that reads your local Copilot usage data and sends your monthly total to the app. Here's exactly what it does and where everything lives.</p>

        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#4f6ef7", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4, marginBottom: 12 }}>What is read</div>
        <p style={p}>Only one file is ever read from your machine — the Copilot CLI session database:</p>
        <div style={mono}>~/.copilot/session-store.db</div>
        <p style={{ ...p, marginTop: 6 }}>A single SQL query extracts your total <code>total_nano_aiu</code> for the current calendar month. No prompts, no code, no conversation content is ever accessed.</p>

        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#4f6ef7", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 20, marginBottom: 12 }}>What is sent</div>
        <p style={p}>A small JSON payload is POSTed to your Vercel deployment every 15 minutes:</p>
        <div style={mono}>{"{ \"aiu\": 1234.5, \"month\": \"2026-08\", \"updated_at\": \"...\", \"input_tokens\": ..., \"output_tokens\": ... }"}</div>
        <p style={{ ...p, marginTop: 6 }}>It is stored under your UUID path in Vercel Blob. No name, email, or identity is ever sent — only the UUID links the data to you, and only you know your UUID.</p>

        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#4f6ef7", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 20, marginBottom: 12 }}>Files created on your machine</div>

        {isWin ? (<>
          <p style={p}><strong>Config directory:</strong></p>
          <div style={mono}>%APPDATA%\aic\uuid</div>
          <div style={{ ...mono, marginTop: 4 }}>%APPDATA%\aic\update-usage.ps1</div>
          <p style={{ ...p, marginTop: 8 }}><strong>Scheduled Task:</strong></p>
          <div style={mono}>Task Scheduler → aic-usage-sync</div>
        </>) : (<>
          <p style={p}><strong>Config directory:</strong></p>
          <div style={mono}>~/.config/aic/uuid</div>
          <div style={{ ...mono, marginTop: 4 }}>~/.config/aic/update-usage.sh</div>
          <p style={{ ...p, marginTop: 8 }}><strong>macOS — launchd agent:</strong></p>
          <div style={mono}>~/Library/LaunchAgents/com.aic.usage-sync.plist</div>
          <p style={{ ...p, marginTop: 8 }}><strong>Log file (macOS):</strong></p>
          <div style={mono}>/tmp/aic-usage-sync.log</div>
          <p style={{ ...p, marginTop: 8 }}><strong>Linux — cron entry:</strong></p>
          <div style={mono}>*/15 * * * * bash ~/.config/aic/update-usage.sh</div>
        </>)}

        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#e05252", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 20, marginBottom: 12 }}>How to remove everything manually</div>

        {isWin ? (<>
          <p style={p}><strong>1. Remove the scheduled task:</strong></p>
          <div style={mono}>Unregister-ScheduledTask -TaskName "aic-usage-sync" -Confirm:$false</div>
          <p style={{ ...p, marginTop: 8 }}><strong>2. Delete the config folder:</strong></p>
          <div style={mono}>Remove-Item -Recurse -Force "$env:APPDATA\aic"</div>
        </>) : (<>
          <p style={p}><strong>macOS — stop and remove launchd agent:</strong></p>
          <div style={mono}>launchctl unload ~/Library/LaunchAgents/com.aic.usage-sync.plist</div>
          <div style={{ ...mono, marginTop: 4 }}>rm ~/Library/LaunchAgents/com.aic.usage-sync.plist</div>
          <p style={{ ...p, marginTop: 8 }}><strong>Linux — remove cron entry:</strong></p>
          <div style={mono}>crontab -l | grep -v "aic/update-usage.sh" | crontab -</div>
          <p style={{ ...p, marginTop: 8 }}><strong>Delete config files (macOS &amp; Linux):</strong></p>
          <div style={mono}>rm -rf ~/.config/aic</div>
          <p style={{ ...p, marginTop: 8 }}><strong>Delete log file (macOS):</strong></p>
          <div style={mono}>rm -f /tmp/aic-usage-sync.log</div>
        </>)}

        <p style={{ ...p, marginTop: 12 }}><strong>Clear browser storage:</strong> open your browser's developer tools → Application → Local Storage → delete all <code>aic_</code> keys, or clear everything for this site.</p>

        <div style={{ marginTop: 20, padding: "10px 14px", background: "#f4f5fb", borderRadius: 8, fontSize: "0.75rem", color: "#888" }}>
          Or run the uninstall script which does all of the above automatically — see the README or the sync setup page.
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const today = new Date();
  const path = window.location.pathname;
  const isAutoRoute = path === "/auto";

  // Team routing
  const teamCreateMatch = path === "/team";
  const teamJoinMatch = path.match(/^\/team\/([^/]+)\/join$/);
  const teamViewMatch = path.match(/^\/team\/([^/]+)$/);
  if (path === "/privacy") return <PrivacyPage />;
  if (path === "/report") return <ReportPage />;
  if (teamCreateMatch) return <TeamCreate />;
  if (teamJoinMatch) return <TeamJoin teamId={teamJoinMatch[1]} />;
  if (teamViewMatch) return <TeamView teamId={teamViewMatch[1]} />;

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [monthlyAIC, setMonthlyAIC] = useState(() => localStorage.getItem("aic_monthly") ?? "");
  const [usedAIC, setUsedAIC] = useState(() => { const v = localStorage.getItem("aic_used"); return v ? String(Math.round(parseFloat(v))) : ""; });
  const [showAutoModal, setShowAutoModal] = useState(isAutoRoute);
  const [syncStatus, setSyncStatus] = useState(null); // null | "ok" | "error"
  const [syncData, setSyncData] = useState(null);
  const [teamData, setTeamData] = useState(null);

  function updateMonthlyAIC(val) {
    setMonthlyAIC(val);
    localStorage.setItem("aic_monthly", val);
    const uuid = localStorage.getItem("aic_sync_uuid");
    if (uuid && val) {
      fetch(`/api/usage/${uuid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budget: parseFloat(val) }),
      }).catch(() => {});
    }
  }
  function updateUsedAIC(val) { setUsedAIC(val); localStorage.setItem("aic_used", val); }

  const fetchUsage = useCallback(() => {
    const uuid = localStorage.getItem("aic_sync_uuid");
    if (!uuid) return;
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    fetch(`/api/usage/${uuid}?t=${Date.now()}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        if (data.month === currentMonth && data.aiu != null) {
          setUsedAIC(String(Math.round(data.aiu)));
          localStorage.setItem("aic_used", String(data.aiu));
          setSyncData(data);
          setSyncStatus("ok");
          fetchTeam();
        }
      })
      .catch(() => setSyncStatus("error"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchUsage();
    const interval = setInterval(fetchUsage, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchUsage]);

  useEffect(() => {
    const uuid = localStorage.getItem("aic_sync_uuid");
    const budget = parseFloat(localStorage.getItem("aic_monthly"));
    if (!uuid || !budget) return;
    fetch(`/api/usage/${uuid}?t=${Date.now()}`)
      .then(r => r.json())
      .then(data => {
        if (data.budget == null && budget) {
          fetch(`/api/usage/${uuid}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ budget }),
          }).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const fetchTeam = useCallback(() => {
    const teamId = localStorage.getItem("aic_team_id");
    if (!teamId) return;
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    fetch(`/api/team/${teamId}?t=${Date.now()}`)
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          const members = data.members
            .filter(m => m.usage?.month === currentMonth)
            .map(m => ({ ...m, aiu: m.usage.aiu, budget: m.usage.budget ?? null }));
          setTeamData({ ...data, members });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchTeam();
    const interval = setInterval(fetchTeam, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTeam]);

  const aicInsight = useMemo(() => {
    const budget = parseFloat(monthlyAIC);
    const used = parseFloat(usedAIC);
    if (!budget || !used || isNaN(budget) || isNaN(used)) return null;

    const dayOfMonth = today.getDate();
    const totalDays = daysInMonth(today.getFullYear(), today.getMonth());
    const daysLeft = totalDays - dayOfMonth;
    const daysGone = dayOfMonth;

    const dailyBurnRate = used / daysGone;
    const projected = dailyBurnRate * totalDays;
    const remaining = budget - used;
    const allowedDailyFromNow = daysLeft > 0 ? remaining / daysLeft : 0;
    const overBudget = projected > budget;
    const pctUsed = (used / budget) * 100;
    const expectedPctUsed = (daysGone / totalDays) * 100;
    const burnStatus = pctUsed - expectedPctUsed;

    return { dailyBurnRate, projected, remaining, allowedDailyFromNow, overBudget, pctUsed, burnStatus };
  }, [monthlyAIC, usedAIC]);

  const totalDays = daysInMonth(viewYear, viewMonth);
  const totalWD = totalWorkdays(viewYear, viewMonth);

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const isPastMonth =
    viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth < today.getMonth());

  let wdGone = isPastMonth
    ? totalWD
    : isCurrentMonth
    ? countWorkdays(viewYear, viewMonth, today.getDate())
    : 0;

  const pctGone = totalWD > 0 ? (wdGone / totalWD) * 100 : 0;

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  const hasSyncUUID = !!localStorage.getItem("aic_sync_uuid");

  return (
    <div style={{ minHeight: "100vh", background: "#f4f5fb", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px" }}>
      <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", width: "100%", maxWidth: 480, color: "#1a1a2e" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button onClick={prevMonth} style={navBtn}>←</button>
          <div style={{ fontSize: "1.3rem", fontWeight: 700, letterSpacing: -0.5 }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <a href="/team" style={{ ...navBtn, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: "0.75rem", fontWeight: 600, color: "#4f6ef7" }}>Team</a>
            <a href="/report" style={{ ...navBtn, display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: "0.75rem", fontWeight: 600, color: "#4f6ef7" }}>Report</a>
            <button onClick={nextMonth} style={navBtn}>→</button>
          </div>
        </div>

        {/* Workday progress bar */}
        <div style={{ fontSize: "0.75rem", color: "#888", display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span>{wdGone} of {totalWD} workdays elapsed</span>
          <span style={{ fontWeight: 600, color: "#4f6ef7" }}>{pctGone.toFixed(1)}%</span>
        </div>
        <div style={{ background: "#eef0ff", borderRadius: 8, height: 7, marginBottom: 18, overflow: "hidden" }}>
          <div style={{ width: `${pctGone}%`, height: "100%", background: "linear-gradient(90deg,#4f6ef7,#7b8ff7)", borderRadius: 8, transition: "width 0.3s" }} />
        </div>

        {/* Weekday labels */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 4 }}>
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d, i) => (
            <div key={d} style={{ textAlign: "center", fontSize: "0.68rem", fontWeight: 600, color: i >= 5 ? "#ccc" : "#aaa", textTransform: "uppercase", padding: "2px 0" }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        {(() => {
          const budget = parseFloat(monthlyAIC);
          const showBurn = aicInsight && isCurrentMonth && budget > 0;
          const { dailyBurnRate } = aicInsight || {};
          const runOutDay = showBurn ? Math.ceil(budget / dailyBurnRate) : null;

          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
              {cells.map((day, idx) => {
                if (day === null) return <div key={`e${idx}`} />;
                const weekend = isWeekend(viewYear, viewMonth, day);
                const isToday = isCurrentMonth && day === today.getDate();
                const isPast = isCurrentMonth ? day < today.getDate() : isPastMonth;
                const isRunOut = runOutDay !== null && day === runOutDay && runOutDay <= totalDays;

                let bg = weekend ? "#fafafa" : "#f7f8ff";
                let border = weekend ? "1px solid #f0f0f0" : "1px solid #e8eaff";
                let numColor = weekend ? "#bbb" : "#222";

                if (isRunOut && !isToday) { bg = "#fff5f5"; border = "2px solid #e05252"; }
                if (isToday) { bg = "#4f6ef7"; border = "1px solid #4f6ef7"; numColor = "#fff"; }

                // Target %: linear daily — where you should be by this day
                const targetPct = (day / totalDays) * 100;
                // Actual %: where you'll be at current burn rate
                const actualPct = showBurn ? (dailyBurnRate * day / budget) * 100 : null;

                const targetLabel = !weekend ? `${targetPct.toFixed(0)}%` : null;
                const actualLabel = showBurn && !weekend ? `${Math.min(actualPct, 999).toFixed(0)}%` : null;

                const targetColor = isToday ? "rgba(255,255,255,0.7)" : "#aaa";
                const actualColor = isToday ? "#fff"
                  : actualPct == null ? null
                  : actualPct > targetPct + 5 ? "#e05252"
                  : actualPct < targetPct - 5 ? "#3ab87a"
                  : "#4f6ef7";

                return (
                  <div key={day} style={{ background: bg, border, borderRadius: 9, minHeight: 60, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, padding: "4px 2px" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: 600, color: numColor, lineHeight: 1 }}>{day}</div>
                    {targetLabel && (
                      <div style={{ fontSize: "0.58rem", fontWeight: 500, color: targetColor, lineHeight: 1 }}>{targetLabel}</div>
                    )}
                    {actualLabel && (
                      <div style={{ fontSize: "0.62rem", fontWeight: 700, color: actualColor, lineHeight: 1 }}>{actualLabel}</div>
                    )}
                    {isRunOut && !isToday && (
                      <div style={{ fontSize: "0.5rem", color: "#e05252", fontWeight: 700, lineHeight: 1 }}>out</div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* AIC Panel */}
        <div style={{ marginTop: 14, background: "#fff", borderRadius: 10, padding: "12px 14px", border: "1px solid #e8eaff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#4f6ef7", textTransform: "uppercase", letterSpacing: 0.5 }}>AI Credits (AIC)</div>
            <button
              onClick={() => setShowAutoModal(true)}
              title={hasSyncUUID ? (syncStatus === "ok" ? "Synced" : "Auto-sync configured") : "Set up auto-sync"}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: hasSyncUUID ? (syncStatus === "ok" ? "#3ab87a" : "#aaa") : "#aaa", padding: 0 }}
            >
              {hasSyncUUID ? (syncStatus === "ok" ? "⬤ synced" : "⬤ sync") : "⬤ set up sync"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: aicInsight ? 12 : 0 }}>
            <label style={{ flex: 1, fontSize: "0.75rem", color: "#666" }}>
              Monthly budget
              <input type="number" value={monthlyAIC} onChange={e => updateMonthlyAIC(e.target.value)} placeholder="e.g. 1000" style={inputStyle} />
            </label>
            <label style={{ flex: 1, fontSize: "0.75rem", color: "#666" }}>
              Used so far
              <input type="number" value={usedAIC} onChange={e => updateUsedAIC(e.target.value)} placeholder="e.g. 340" style={inputStyle} />
            </label>
          </div>

          {syncData && syncData.script_version !== __CURRENT_SCRIPT_VERSION__ && (
            <div style={{ background: "#fff8e6", border: "1px solid #f5d97a", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: "0.75rem", color: "#7a5c00" }}>
              Your sync script is out of date (v{syncData.script_version} → v{__CURRENT_SCRIPT_VERSION__}). Re-run the install script to update.
            </div>
          )}

          {syncData && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12, fontSize: "0.7rem", color: "#888" }}>
              <div style={statBox}>
                <div>Input tokens</div>
                <div style={{ fontWeight: 700, color: "#333" }}>{syncData.input_tokens.toLocaleString()}</div>
              </div>
              <div style={statBox}>
                <div>Output tokens</div>
                <div style={{ fontWeight: 700, color: "#333" }}>{syncData.output_tokens.toLocaleString()}</div>
              </div>
              <div style={statBox}>
                <div>Last synced</div>
                <div style={{ fontWeight: 700, color: "#333" }}>{timeAgo(syncData.updated_at)}</div>
              </div>
            </div>
          )}

          {aicInsight && (() => {
            const { dailyBurnRate, projected, remaining, allowedDailyFromNow, overBudget, pctUsed, burnStatus } = aicInsight;
            const statusColor = overBudget ? "#e05252" : burnStatus > 10 ? "#e0953a" : "#3ab87a";
            const statusLabel = overBudget ? "⚠️ Over budget on current pace" : burnStatus > 10 ? "🟠 Burning faster than expected — ease up" : "✅ On track";
            const barPct = Math.min(pctUsed, 100);
            return (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#888", marginBottom: 3 }}>
                  <span>{parseFloat(usedAIC).toFixed(0)} / {parseFloat(monthlyAIC).toFixed(0)} used</span>
                  <span style={{ fontWeight: 600, color: statusColor }}>{pctUsed.toFixed(1)}%</span>
                </div>
                <div style={{ background: "#e8eaff", borderRadius: 8, height: 7, marginBottom: 10, overflow: "hidden" }}>
                  <div style={{ width: `${barPct}%`, height: "100%", background: overBudget ? "#e05252" : burnStatus > 10 ? "#e0953a" : "#3ab87a", borderRadius: 8, transition: "width 0.3s" }} />
                </div>
                <div style={{ fontSize: "0.78rem", fontWeight: 600, color: statusColor, marginBottom: 10 }}>{statusLabel}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, fontSize: "0.72rem", color: "#666" }}>
                  <div style={statBox}><div>Daily burn</div><div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#333" }}>{dailyBurnRate.toFixed(1)}</div></div>
                  <div style={statBox}><div>Projected total</div><div style={{ fontSize: "0.95rem", fontWeight: 700, color: overBudget ? "#e05252" : "#333" }}>{projected.toFixed(0)}</div></div>
                  <div style={statBox}><div>Max/day left</div><div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#3ab87a" }}>{allowedDailyFromNow.toFixed(1)}</div></div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Summary */}
        <div style={{ marginTop: 10, background: "#fff", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 20, fontSize: "0.78rem", color: "#666", border: "1px solid #e8eaff" }}>
          {[["Total workdays", totalWD], ["Elapsed", wdGone], ["Remaining", totalWD - wdGone], ["Progress", pctGone.toFixed(1) + "%"]].map(([label, val]) => (
            <div key={label}>
              <div>{label}</div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#4f6ef7" }}>{val}</div>
            </div>
          ))}
        </div>

        {teamData && teamData.members.length > 0 && <TeamSidePanels members={teamData.members} today={today} />}

      </div>

      {showAutoModal && <AutoModal onClose={() => { setShowAutoModal(false); if (isAutoRoute) window.location.href = "/"; }} />}

      <div style={{ position: "fixed", bottom: 8, right: 10, fontSize: "0.6rem", color: "#999", fontFamily: "monospace", pointerEvents: "none" }}>
        {__BUILD_HASH__} · {new Date(__BUILD_TIME__).toLocaleString()}
      </div>
    </div>
  );
}

const navBtn = {
  background: "#eef0ff",
  border: "none",
  borderRadius: 8,
  width: 34,
  height: 34,
  cursor: "pointer",
  fontSize: "1rem",
  color: "#333",
};

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "6px 8px",
  borderRadius: 7,
  border: "1px solid #dde0f5",
  fontSize: "0.85rem",
  background: "#f7f8ff",
  color: "#1a1a2e",
  outline: "none",
  boxSizing: "border-box",
};

const statBox = {
  background: "#f7f8ff",
  border: "1px solid #e8eaff",
  borderRadius: 8,
  padding: "6px 10px",
};
