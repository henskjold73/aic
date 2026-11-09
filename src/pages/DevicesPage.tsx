import { useCallback, useEffect, useState, type CSSProperties, type ChangeEvent, type JSX } from "react";
import { ApiRequestError, dismissDuplicate, fetchDevices, pairWithCode, patchDevice } from "@/lib/api";
import { COLORS } from "@/lib/constants";
import { getAccount, refreshSession, signIn } from "@/lib/session";
import { backLink, btnPrimary, btnSecondary, card, FONT_STACK, inputStyle, pageWrap } from "@/styles";
import type { AccountWarning, DeviceInfo, DevicesResponse } from "@/types";

const sectionTitle: CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 700,
  color: COLORS.primary,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  margin: "20px 0 8px",
};

const smallMuted: CSSProperties = { fontSize: "0.72rem", color: COLORS.faint, lineHeight: 1.45 };

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function nameOf(device: DeviceInfo | undefined): string {
  return device ? (device.label ?? `Key …${device.hint}`) : "unknown key";
}

/** `/devices` — the account's sync keys: pair a new machine, label, disable, fix double counting. */
export function DevicesPage(): JSX.Element {
  const account = getAccount();
  const [data, setData] = useState<DevicesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState<string>("");
  const [pairMessage, setPairMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const load = useCallback((): void => {
    fetchDevices()
      .then(setData)
      .catch(() => setError("Could not load your devices."));
  }, []);

  useEffect(() => {
    if (account) load();
  }, [account, load]);

  if (!account) {
    return (
      <div style={pageWrap}>
        <div style={card}>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 8 }}>Devices</div>
          <div style={{ fontSize: "0.8rem", color: COLORS.muted, marginBottom: 16 }}>
            Sign in to link your machines to one account, so your usage follows you across
            browsers and computers.
          </div>
          <button onClick={() => signIn("/devices")} style={btnPrimary}>
            Sign in with GitHub
          </button>
          <div style={{ marginTop: 12 }}>
            <a href="/" style={backLink}>
              Back
            </a>
          </div>
        </div>
      </div>
    );
  }

  async function pair(): Promise<void> {
    setBusy(true);
    setPairMessage(null);
    try {
      await pairWithCode(code);
      setCode("");
      setPairMessage({ ok: true, text: "Linked! It will show up below after its next sync." });
      await refreshSession();
      load();
    } catch (err) {
      const text =
        err instanceof ApiRequestError && err.status === 429
          ? "Too many wrong codes. Wait a few minutes and try again."
          : err instanceof ApiRequestError && err.status === 409
            ? "That machine is already linked to a different account."
            : "That code is invalid or has expired. Re-run the install command for a new one.";
      setPairMessage({ ok: false, text });
    } finally {
      setBusy(false);
    }
  }

  async function change(action: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    try {
      await action();
      await refreshSession();
      load();
    } catch {
      setError("That didn't work — try again.");
    } finally {
      setBusy(false);
    }
  }

  const devices = data?.devices ?? [];
  const byId = new Map(devices.map((d) => [d.id, d]));

  function renderWarning(w: AccountWarning): JSX.Element {
    const [idA, idB] = w.key_ids;
    const a = byId.get(idA);
    const b = byId.get(idB);
    // Suggest disabling the key that has synced least recently.
    const older =
      (a?.last_ping_at ?? "") <= (b?.last_ping_at ?? "") ? a : b;
    return (
      <div
        key={`${idA}-${idB}`}
        style={{
          background: "#fff6e5",
          border: `1px solid ${COLORS.warn}`,
          borderRadius: 10,
          padding: "10px 12px",
          marginBottom: 8,
          fontSize: "0.78rem",
          color: "#7a4b00",
          lineHeight: 1.45,
        }}
      >
        <strong>{w.reason === "same_database" ? "Counted twice." : "Possibly counted twice."}</strong>{" "}
        “{nameOf(a)}” and “{nameOf(b)}”{" "}
        {w.reason === "same_database"
          ? "read the same Copilot database"
          : "report identical totals on several past days"}
        , so this month is overstated by about {Math.round(w.overstated_aiu).toLocaleString()} AIU.
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {older && (
            <button
              style={btnSecondary}
              disabled={busy}
              onClick={() => void change(() => patchDevice({ id: older.id, disabled: true }))}
            >
              Disable “{nameOf(older)}”
            </button>
          )}
          <button
            style={btnSecondary}
            disabled={busy}
            onClick={() => void change(() => dismissDuplicate(w.key_ids))}
          >
            They’re different machines
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <div style={{ ...card, maxWidth: 520, fontFamily: FONT_STACK }}>
        <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>Devices</div>
        <div style={{ ...smallMuted, marginBottom: 4 }}>
          Signed in as {account.display_name ?? "your account"}. Each machine running the sync
          script has its own key; your calendar adds them together.
        </div>

        {(data?.warnings ?? []).length > 0 && (
          <>
            <div style={sectionTitle}>Needs attention</div>
            {data?.warnings.map(renderWarning)}
          </>
        )}

        <div style={sectionTitle}>Link a new machine</div>
        <div style={{ ...smallMuted, marginBottom: 8 }}>
          Run the install command on the machine (see{" "}
          <a href="/auto" style={{ color: COLORS.primary }}>
            Connect auto-sync
          </a>
          ). It prints an 8-character code — enter it here.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={code}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value)}
            placeholder="XXXX-XXXX"
            maxLength={9}
            style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase" }}
          />
          <button
            style={{ ...btnPrimary, width: "auto" }}
            disabled={busy || code.trim().length < 8}
            onClick={() => void pair()}
          >
            Link
          </button>
        </div>
        {pairMessage && (
          <div style={{ fontSize: "0.75rem", marginTop: 6, color: pairMessage.ok ? COLORS.good : COLORS.bad }}>
            {pairMessage.text}
          </div>
        )}

        <div style={sectionTitle}>Your machines</div>
        {error && <div style={{ fontSize: "0.75rem", color: COLORS.bad }}>{error}</div>}
        {!data && !error && <div style={smallMuted}>Loading…</div>}
        {data && devices.length === 0 && (
          <div style={smallMuted}>No machines linked yet.</div>
        )}
        {devices.map((device) => (
          <DeviceRowView
            key={device.id}
            device={device}
            busy={busy}
            onRename={(label) => void change(() => patchDevice({ id: device.id, label }))}
            onToggle={() =>
              void change(() => patchDevice({ id: device.id, disabled: !device.disabled }))
            }
          />
        ))}
        {data && devices.length > 0 && (
          <div style={{ ...smallMuted, marginTop: 6 }}>
            Disabled machines keep syncing but are left out of your totals. Nothing is deleted.
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <a href="/" style={backLink}>
            Back
          </a>
        </div>
      </div>
    </div>
  );
}

interface DeviceRowViewProps {
  device: DeviceInfo;
  busy: boolean;
  onRename: (label: string) => void;
  onToggle: () => void;
}

function DeviceRowView({ device, busy, onRename, onToggle }: DeviceRowViewProps): JSX.Element {
  const [label, setLabel] = useState<string>(device.label ?? "");
  useEffect(() => setLabel(device.label ?? ""), [device.label]);

  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 8,
        opacity: device.disabled ? 0.55 : 1,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={label}
          placeholder={`Name this machine (key …${device.hint})`}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setLabel(e.target.value)}
          onBlur={() => {
            if (label.trim() !== (device.label ?? "")) onRename(label);
          }}
          maxLength={40}
          style={{ ...inputStyle, fontWeight: 600, padding: "5px 8px" }}
        />
        <button style={btnSecondary} disabled={busy} onClick={onToggle}>
          {device.disabled ? "Enable" : "Disable"}
        </button>
      </div>
      <div style={{ ...smallMuted, marginTop: 6 }}>
        {Math.round(device.aiu_month).toLocaleString()} AIU this month · synced{" "}
        {timeAgo(device.last_ping_at)}
        {device.script_version ? ` · script v${device.script_version}` : ""}
        {device.disabled ? " · disabled" : ""}
      </div>
    </div>
  );
}
