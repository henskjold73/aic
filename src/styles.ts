import type { CSSProperties } from "react";
import { COLORS, VIEWPORT_HEIGHT } from "@/lib/constants";

/**
 * Condensed UI font, as in ElvUI (which defaults to PT Sans Narrow). Falls back
 * to whatever narrow face the system has; no web font is downloaded.
 */
export const FONT_STACK =
  "'PT Sans Narrow', 'Arial Narrow', 'Roboto Condensed', 'Helvetica Neue', Arial, sans-serif";

/** Corner radius for everything: ElvUI is square, with at most a 2px softening. */
export const RADIUS = 2;

/**
 * ElvUI's double edge: a 1px black outer border with a 1px dark-grey highlight
 * just inside it. Spread into any panel-like style.
 */
export const edge: CSSProperties = {
  border: `1px solid ${COLORS.border}`,
  boxShadow: `inset 0 0 0 1px ${COLORS.inner}`,
  borderRadius: RADIUS,
};

/** Same edge with the inner highlight in the accent colour (focus / hover / selected). */
export const edgeActive: CSSProperties = {
  border: `1px solid ${COLORS.border}`,
  boxShadow: `inset 0 0 0 1px ${COLORS.primary}`,
  borderRadius: RADIUS,
};

/** ElvUI status-bar track: dark well, black outer edge, flat fill drawn inside. */
export function statusTrack(height: number): CSSProperties {
  return {
    background: COLORS.page,
    border: `1px solid ${COLORS.border}`,
    boxShadow: `inset 0 0 0 1px #1c1c1c`,
    borderRadius: RADIUS,
    height,
    boxSizing: "border-box",
    overflow: "hidden",
  };
}

export const pageWrap: CSSProperties = {
  boxSizing: "border-box",
  minHeight: VIEWPORT_HEIGHT,
  background: COLORS.page,
  color: COLORS.ink,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "16px 12px",
};

export const card: CSSProperties = {
  ...edge,
  background: COLORS.surface,
  color: COLORS.ink,
  padding: "22px 22px",
  width: "100%",
  maxWidth: 420,
  fontFamily: FONT_STACK,
};

export const btnPrimary: CSSProperties = {
  ...edgeActive,
  padding: "7px 18px",
  background: COLORS.primaryBg,
  color: "#fff",
  fontWeight: 700,
  fontSize: "0.85rem",
  letterSpacing: 0.3,
  textTransform: "uppercase",
  cursor: "pointer",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

export const btnSecondary: CSSProperties = {
  ...edge,
  padding: "5px 12px",
  background: COLORS.tint,
  color: COLORS.ink,
  fontWeight: 700,
  fontSize: "0.78rem",
  letterSpacing: 0.3,
  textTransform: "uppercase",
  cursor: "pointer",
  fontFamily: "inherit",
};

export const navBtn: CSSProperties = {
  ...edge,
  background: COLORS.tint,
  width: 40,
  height: 40,
  cursor: "pointer",
  fontSize: "1rem",
  color: COLORS.ink,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const inputStyle: CSSProperties = {
  ...edge,
  display: "block",
  width: "100%",
  marginTop: 4,
  padding: "6px 8px",
  fontSize: "0.85rem",
  fontFamily: "inherit",
  background: COLORS.page,
  color: COLORS.ink,
  outline: "none",
  boxSizing: "border-box",
};

export const statBox: CSSProperties = {
  ...edge,
  background: COLORS.tint,
  padding: "6px 10px",
};

export const panel: CSSProperties = {
  ...edge,
  background: COLORS.surface,
  color: COLORS.ink,
  padding: "12px 14px",
};

export const monoBlock: CSSProperties = {
  ...edge,
  background: COLORS.page,
  padding: "10px 12px",
  fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  fontSize: "0.72rem",
  color: COLORS.muted,
  wordBreak: "break-all",
};

export const sectionLabel: CSSProperties = {
  fontSize: "0.7rem",
  fontWeight: 700,
  color: COLORS.primary,
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

export const backLink: CSSProperties = {
  fontSize: "0.75rem",
  color: COLORS.faint,
  textDecoration: "none",
};

/**
 * Version stamp: a solid panel fill with a 1px gradient border. The fill is
 * clipped to the padding box and the gradient to the border box, so the
 * gradient only shows through the transparent border.
 */
export const buildStamp: CSSProperties = {
  position: "fixed",
  bottom: 8,
  right: 10,
  padding: "3px 8px",
  fontSize: "0.6rem",
  color: COLORS.muted,
  fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  border: "1px solid transparent",
  borderRadius: RADIUS,
  background: `linear-gradient(${COLORS.surface}, ${COLORS.surface}) padding-box, linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryLight} 50%, ${COLORS.good}) border-box`,
  pointerEvents: "none",
};
