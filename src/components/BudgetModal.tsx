import { useState, type JSX } from "react";
import { COLORS } from "@/lib/constants";
import { inputStyle } from "@/styles";

export interface BudgetModalProps {
  /** Called with the confirmed budget (a positive number as a string). */
  onConfirm: (value: string) => void;
  /** Called when the user skips for now. */
  onClose: () => void;
}

const buttonBase = {
  padding: "8px 14px",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 2,
  fontWeight: 700,
  fontSize: "0.85rem",
  textTransform: "uppercase",
  letterSpacing: 0.3,
  cursor: "pointer",
} as const;

/** Asks the user to confirm their monthly AIU budget when none is stored anywhere. */
export function BudgetModal({ onConfirm, onClose }: BudgetModalProps): JSX.Element {
  const [value, setValue] = useState<string>("");
  const parsed = Number.parseFloat(value);
  const valid = Number.isFinite(parsed) && parsed > 0;

  function submit(): void {
    if (valid) onConfirm(String(parsed));
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="budget-modal-title"
        style={{
          background: COLORS.surface,
          borderRadius: 2,
          padding: "28px 24px",
          width: "100%",
          maxWidth: 420,
          border: `1px solid ${COLORS.border}`,
          boxShadow: `inset 0 0 0 1px ${COLORS.inner}`,
        }}
      >
        <div
          id="budget-modal-title"
          style={{ fontSize: "1.1rem", fontWeight: 700, color: COLORS.ink, marginBottom: 6 }}
        >
          Set your monthly budget
        </div>
        <div
          style={{ fontSize: "0.8rem", color: COLORS.muted, marginBottom: 16, lineHeight: 1.5 }}
        >
          We couldn't find a budget for you, so team views can't work out your daily
          allowance. Enter your monthly AIU budget to confirm it.
        </div>
        <input
          autoFocus
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="Monthly AIU budget"
          style={{ ...inputStyle, marginBottom: 14 }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={submit}
            disabled={!valid}
            style={{
              ...buttonBase,
              flex: 1,
              background: COLORS.primaryBg,
              color: "#fff",
              boxShadow: `inset 0 0 0 1px ${COLORS.primary}`,
              opacity: valid ? 1 : 0.5,
              cursor: valid ? "pointer" : "not-allowed",
            }}
          >
            Confirm
          </button>
          <button
            onClick={onClose}
            style={{
              ...buttonBase,
              background: COLORS.tint,
              color: COLORS.muted,
              boxShadow: `inset 0 0 0 1px ${COLORS.inner}`,
            }}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
