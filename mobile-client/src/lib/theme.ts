/**
 * Storm-Cyan theme — mirrors the web client's default `storm-cyan` data-theme.
 *
 * Background:   #0f282f  (Storm Green)
 * Card surface: #0a1e23  (deep teal, ≈ rgba(6,22,26,0.80) on Storm Green)
 * Accent:       #02eff0  (vivid cyan — same as web `--glow-1` hue)
 */

export const T = {
  /** Page / screen background */
  bg:         "#0f282f",
  /** Card / panel surface */
  card:       "#0a1e23",
  /** Slightly lighter card (nested panels) */
  cardAlt:    "#0d2429",
  /** Faint card border */
  border:     "rgba(255,255,255,0.08)",
  /** Accent border (cyan-tinted) */
  accentBorder: "rgba(2,239,240,0.28)",
  /** Primary accent (vivid cyan) */
  accent:     "#02eff0",
  /** Accent at low opacity — icon backgrounds, filter active, etc. */
  accentDim:  "rgba(2,239,240,0.12)",
  /** Disabled accent */
  accentFaint:"rgba(2,239,240,0.30)",

  /** Full-white body text */
  text:       "#ffffff",
  /** Dimmed label text */
  textDim:    "rgba(255,255,255,0.5)",
  /** Muted / placeholder text */
  textMuted:  "rgba(255,255,255,0.3)",

  /** Text rendered ON a cyan-filled button (must be dark for contrast) */
  onAccent:   "#061b1c",

  /** Semantic: paid / success */
  green:      "#3ec97e",
  /** Semantic: warning / due */
  orange:     "#f4a942",
  /** Semantic: error */
  red:        "#e25c5c",
  /** Muted empty-state icon colour */
  iconMuted:  "#1a3d3f",
} as const;
