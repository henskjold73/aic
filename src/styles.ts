import type { CSSProperties } from "react";
import { COLORS } from "@/lib/constants";

/** System font stack used by every screen. */
export const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const pageWrap: CSSProperties = {
  minHeight: "100vh",
  background: COLORS.page,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "16px 12px",
};

export const card: CSSProperties = {
  background: COLORS.surface,
  borderRadius: 14,
  padding: "28px 24px",
  width: "100%",
  maxWidth: 420,
  boxShadow: "0 8px 40px rgba(79,110,247,0.1)",
  fontFamily: FONT_STACK,
};

export const btnPrimary: CSSProperties = {
  padding: "8px 18px",
  background: COLORS.primary,
  color: "#fff",
  border: "none",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: "0.85rem",
  cursor: "pointer",
  width: "100%",
};

export const btnSecondary: CSSProperties = {
  padding: "6px 12px",
  background: COLORS.tint,
  color: COLORS.primary,
  border: "none",
  borderRadius: 8,
  fontWeight: 600,
  fontSize: "0.78rem",
  cursor: "pointer",
};

export const navBtn: CSSProperties = {
  background: COLORS.tint,
  border: "none",
  borderRadius: 8,
  width: 40,
  height: 40,
  cursor: "pointer",
  fontSize: "1rem",
  color: "#333",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const inputStyle: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "6px 8px",
  borderRadius: 7,
  border: "1px solid #dde0f5",
  fontSize: "0.85rem",
  background: "#f7f8ff",
  color: COLORS.ink,
  outline: "none",
  boxSizing: "border-box",
};

export const statBox: CSSProperties = {
  background: "#f7f8ff",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  padding: "6px 10px",
};

export const panel: CSSProperties = {
  background: COLORS.surface,
  borderRadius: 10,
  padding: "12px 14px",
  border: `1px solid ${COLORS.border}`,
};

export const monoBlock: CSSProperties = {
  background: COLORS.page,
  borderRadius: 8,
  padding: "10px 12px",
  fontFamily: "monospace",
  fontSize: "0.72rem",
  color: "#555",
  wordBreak: "break-all",
};

export const sectionLabel: CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 700,
  color: COLORS.primary,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

export const backLink: CSSProperties = {
  fontSize: "0.75rem",
  color: COLORS.faint,
  textDecoration: "none",
};

export const buildStamp: CSSProperties = {
  position: "fixed",
  bottom: 8,
  right: 10,
  fontSize: "0.6rem",
  color: "#999",
  fontFamily: "monospace",
  pointerEvents: "none",
};
