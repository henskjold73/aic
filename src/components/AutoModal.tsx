import { useState, type ChangeEvent, type JSX } from "react";
import { ApiRequestError, attachKey } from "@/lib/api";
import { COLORS, isUuid, syncCommands } from "@/lib/constants";
import { getAccount, signIn } from "@/lib/session";
import { clearSyncUuid, getSyncUuid, setSyncUuid } from "@/lib/storage";
import { inputStyle, monoBlock } from "@/styles";

export interface AutoModalProps {
  /** Called when the user dismisses the modal without saving. */
  onClose: () => void;
}

/** Outcome of the last save attempt. */
type SaveStatus = "error" | "key_taken" | "saved" | null;

const labelStyle = { fontSize: "0.7rem", color: COLORS.faint, marginBottom: 4 } as const;

/** Modal that captures the sync UUID and shows install/uninstall commands. */
export function AutoModal({ onClose }: AutoModalProps): JSX.Element {
  const account = getAccount();
  const [input, setInput] = useState<string>(() => (account ? "" : (getSyncUuid() ?? "")));
  const [status, setStatus] = useState<SaveStatus>(null);
  const [hasSaved, setHasSaved] = useState<boolean>(() => !account && getSyncUuid() !== null);

  const { install, uninstall } = syncCommands();

  function finish(): void {
    setStatus("saved");
    window.setTimeout(() => {
      window.location.href = "/";
    }, 800);
  }

  function save(): void {
    const value = input.trim();
    if (!isUuid(value)) {
      setStatus("error");
      return;
    }
    if (account) {
      // Signed in: link the key to the account instead of this browser.
      attachKey(value)
        .then(finish)
        .catch((err: unknown) => {
          setStatus(err instanceof ApiRequestError && err.status === 409 ? "key_taken" : "error");
        });
      return;
    }
    setSyncUuid(value);
    setHasSaved(true);
    finish();
  }

  function clear(): void {
    clearSyncUuid();
    setInput("");
    setHasSaved(false);
    setStatus(null);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    setInput(event.target.value);
    setStatus(null);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,20,40,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        style={{
          background: COLORS.surface,
          borderRadius: 14,
          padding: "28px 24px",
          width: "100%",
          maxWidth: 420,
          boxShadow: "0 8px 40px rgba(79,110,247,0.15)",
        }}
      >
        <div
          style={{ fontSize: "1.1rem", fontWeight: 700, color: COLORS.ink, marginBottom: 6 }}
        >
          Connect auto-sync
        </div>
        <div
          style={{
            fontSize: "0.8rem",
            color: COLORS.muted,
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          Run the install script to get your sync UUID, then paste it below. Your Copilot
          usage will update automatically every 20 minutes.
        </div>

        {account ? (
          <div style={{ fontSize: "0.75rem", color: COLORS.muted, marginBottom: 16 }}>
            Signed in as <strong>{account.display_name ?? "your account"}</strong>.{" "}
            {account.keys.length === 0
              ? "No sync keys are connected yet."
              : `Connected keys: ${account.keys
                  .map((k) => `…${k.hint}${k.disabled ? " (disabled)" : ""}`)
                  .join(", ")}.`}{" "}
            The installer prints a code for new machines — enter it on the{" "}
            <a href="/devices" style={{ color: COLORS.primary }}>
              Devices page
            </a>
            . Or paste a UUID below to add a machine you already set up.
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => signIn("/auto")}
              style={{
                width: "100%",
                padding: "8px 0",
                background: COLORS.ink,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Sign in with GitHub
            </button>
            <div style={{ fontSize: "0.7rem", color: COLORS.faint, marginTop: 6 }}>
              Use the same account on any browser or machine. You can also continue without
              signing in; the UUID is then stored only in this browser.
            </div>
          </div>
        )}

        <div style={labelStyle}>Install</div>
        <div style={{ ...monoBlock, marginBottom: 10 }}>{install}</div>
        <div style={labelStyle}>Uninstall</div>
        <div style={{ ...monoBlock, marginBottom: 16 }}>{uninstall}</div>

        <label
          style={{ fontSize: "0.75rem", color: COLORS.muted, display: "block", marginBottom: 12 }}
        >
          Sync UUID
          <input
            value={input}
            onChange={handleChange}
            placeholder="xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx"
            style={{ ...inputStyle, marginTop: 4, fontFamily: "monospace", fontSize: "0.82rem" }}
          />
        </label>

        {status === "error" && (
          <div style={{ fontSize: "0.75rem", color: COLORS.bad, marginBottom: 10 }}>
            Invalid UUID — check the value from the install script.
          </div>
        )}
        {status === "key_taken" && (
          <div style={{ fontSize: "0.75rem", color: COLORS.bad, marginBottom: 10 }}>
            That UUID is already linked to a different account.
          </div>
        )}
        {status === "saved" && (
          <div style={{ fontSize: "0.75rem", color: COLORS.good, marginBottom: 10 }}>
            Saved! Redirecting…
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={save}
            style={{
              flex: 1,
              padding: "8px 0",
              background: COLORS.primary,
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Save
          </button>
          {hasSaved && (
            <button
              onClick={clear}
              style={{
                padding: "8px 14px",
                background: "#fee",
                color: COLORS.bad,
                border: "1px solid #fcc",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: "8px 14px",
              background: COLORS.tint,
              color: "#555",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>

        <div style={{ marginTop: 14, textAlign: "center" }}>
          <a
            href="/privacy"
            style={{ fontSize: "0.7rem", color: COLORS.faint, textDecoration: "none" }}
          >
            What does this install on my computer?
          </a>
        </div>
      </div>
    </div>
  );
}
