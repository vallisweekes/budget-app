export type ThemeMode = "light" | "dark";

export type ThemeTokens = {
  bg: string;
  card: string;
  cardAlt: string;
  border: string;
  accentBorder: string;
  accent: string;
  accentDim: string;
  accentFaint: string;
  text: string;
  textDim: string;
  textMuted: string;
  onAccent: string;
  green: string;
  orange: string;
  red: string;
  iconMuted: string;
};

export const LIGHT_TOKENS: ThemeTokens = {
  bg: "#f2f4f7",
  card: "#ffffff",
  cardAlt: "#ffffff",
  border: "rgba(15,40,47,0.12)",
  accentBorder: "rgba(91,46,255,0.28)",
  accent: "#5b2eff",
  accentDim: "rgba(91,46,255,0.12)",
  accentFaint: "rgba(91,46,255,0.30)",
  text: "#0f282f",
  textDim: "rgba(15,40,47,0.55)",
  textMuted: "rgba(15,40,47,0.35)",
  onAccent: "#ffffff",
  green: "#3ec97e",
  orange: "#f4a942",
  red: "#e25c5c",
  iconMuted: "rgba(15,40,47,0.35)",
};

// Dark scheme (requested) — dark surfaces + purple accent
export const DARK_TOKENS: ThemeTokens = {
  bg: "#0b0d14",
  card: "#141826",
  cardAlt: "#1a1f31",
  border: "rgba(244,246,255,0.10)",
  accentBorder: "rgba(244,246,255,0.10)",
  accent: "#7c5cff",
  accentDim: "rgba(124,92,255,0.12)",
  accentFaint: "rgba(124,92,255,0.28)",
  text: "#f4f6ff",
  textDim: "rgba(244,246,255,0.62)",
  textMuted: "rgba(244,246,255,0.40)",
  onAccent: "#ffffff",
  green: "#2ee58f",
  orange: "#ffb020",
  red: "#ff5c7a",
  iconMuted: "rgba(244,246,255,0.40)",
};

// Mutable theme tokens used throughout the app.
// We keep this object stable so existing imports continue to work.
export const T: ThemeTokens = { ...DARK_TOKENS };

export function applyThemeMode(mode: ThemeMode): ThemeTokens {
  Object.assign(T, mode === "dark" ? DARK_TOKENS : LIGHT_TOKENS);
  return T;
}
