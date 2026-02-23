import React from "react";
import { StyleSheet, Text, TextInput } from "react-native";

type InterFaces = {
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
  extrabold: string;
  black: string;
};

function normalizeWeight(weight: unknown): number | null {
  if (weight == null) return null;
  if (typeof weight === "number" && Number.isFinite(weight)) return weight;
  const w = String(weight).trim().toLowerCase();
  if (!w) return null;
  if (w === "normal") return 400;
  if (w === "bold") return 700;
  const asNum = Number(w);
  if (Number.isFinite(asNum)) return asNum;
  return null;
}

function pickInterFace(faces: InterFaces, weight: unknown): string {
  const w = normalizeWeight(weight);
  if (!w) return faces.regular;
  if (w >= 900) return faces.black;
  if (w >= 800) return faces.extrabold;
  if (w >= 700) return faces.bold;
  if (w >= 600) return faces.semibold;
  if (w >= 500) return faces.medium;
  return faces.regular;
}

function shouldSkipFontOverride(existingFamily: unknown): boolean {
  if (!existingFamily) return false;
  const f = String(existingFamily);
  // Do not override icon fonts or any explicit custom family.
  return /Ionicons|MaterialIcons|MaterialCommunityIcons|FontAwesome|Entypo|Feather|Octicons|SimpleLineIcons|lucide/i.test(
    f
  );
}

export function installInterGlobalTypography(faces: InterFaces) {
  const g = globalThis as unknown as { __budgetAppInterTypographyInstalled?: boolean };
  if (g.__budgetAppInterTypographyInstalled) return;
  g.__budgetAppInterTypographyInstalled = true;

  // Fallback default props (covers some edge cases)
  (Text as any).defaultProps = (Text as any).defaultProps || {};
  (Text as any).defaultProps.style = [
    (Text as any).defaultProps.style,
    { fontFamily: faces.regular, fontWeight: "normal" },
  ];

  (TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
  (TextInput as any).defaultProps.style = [
    (TextInput as any).defaultProps.style,
    { fontFamily: faces.regular, fontWeight: "normal" },
  ];

  // Strong override that preserves icons + explicitly set fontFamily.
  const oldTextRender = (Text as any).render;
  (Text as any).render = function render(...args: any[]) {
    const origin = oldTextRender.call(this, ...args);
    const flat = StyleSheet.flatten(origin?.props?.style);
    const existingFamily = (flat as any)?.fontFamily;
    if (existingFamily && shouldSkipFontOverride(existingFamily)) return origin;
    if (existingFamily) return origin;

    const desiredFamily = pickInterFace(faces, (flat as any)?.fontWeight);

    return React.cloneElement(origin, {
      ...origin.props,
      style: [origin.props.style, { fontFamily: desiredFamily, fontWeight: "normal" }],
    });
  };
}
