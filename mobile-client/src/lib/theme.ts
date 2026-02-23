/**
 * Shared theme tokens.
 *
 * Note: The mobile UI has moved to a light surface with blue sections.
 * The primary accent is now a dark purple (replacing the previous cyan).
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
  /** Accent border (purple-tinted) */
  accentBorder: "rgba(91,46,255,0.28)",
  /** Primary accent (dark purple) */
  accent:     "#5b2eff",
  /** Accent at low opacity — icon backgrounds, filter active, etc. */
  accentDim:  "rgba(91,46,255,0.12)",
  /** Disabled accent */
  accentFaint:"rgba(91,46,255,0.30)",

  /** Full-white body text */
  text:       "#ffffff",
  /** Dimmed label text */
  textDim:    "rgba(255,255,255,0.5)",
  /** Muted / placeholder text */
  textMuted:  "rgba(255,255,255,0.3)",

  /** Text rendered ON an accent-filled button */
  onAccent:   "#ffffff",

  /** Semantic: paid / success */
  green:      "#3ec97e",
  /** Semantic: warning / due */
  orange:     "#f4a942",
  /** Semantic: error */
  red:        "#e25c5c",
  /** Muted empty-state icon colour */
  iconMuted:  "#1a3d3f",
} as const;
