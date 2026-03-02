function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function pickAccent(seed: string, palette: readonly string[]): string {
  return palette[hashString(seed) % palette.length]!;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return null;

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  if (Number.isNaN(red) || Number.isNaN(green) || Number.isNaN(blue)) return null;

  return { r: red, g: green, b: blue };
}

function blendRgb(
  from: { r: number; g: number; b: number },
  to: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } {
  const progress = Math.min(1, Math.max(0, t));
  return {
    r: Math.round(from.r * (1 - progress) + to.r * progress),
    g: Math.round(from.g * (1 - progress) + to.g * progress),
    b: Math.round(from.b * (1 - progress) + to.b * progress),
  };
}

export function tintedDarkBg(accentHex: string, baseHex: string): string {
  const base = hexToRgb(baseHex) ?? { r: 15, g: 40, b: 47 };
  const accent = hexToRgb(accentHex);
  if (!accent) return `rgb(${base.r},${base.g},${base.b})`;

  const mixed = blendRgb(base, accent, 0.14);
  return `rgb(${mixed.r},${mixed.g},${mixed.b})`;
}

export function isLightHex(hex: string): boolean {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return false;

  const red = parseInt(normalized.slice(0, 2), 16) / 255;
  const green = parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = parseInt(normalized.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.72;
}
