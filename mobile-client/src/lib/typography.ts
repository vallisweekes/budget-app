import React from "react";
import { StyleSheet, Text, TextInput } from "react-native";

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

function normalizeToLighterWeight(weight: unknown): string | null {
  const w = normalizeWeight(weight);
  if (!w) return null;
  if (w >= 700) return "500";
  if (w >= 600) return "400";
  if (w >= 500) return "400";
  return null;
}

function normalizeWeightValue(weight: unknown): unknown {
  const mapped = normalizeToLighterWeight(weight);
  return mapped ?? weight;
}

function shouldSkipFontOverride(existingFamily: unknown): boolean {
  if (!existingFamily) return false;
  const f = String(existingFamily);
  // Do not override icon fonts or any explicit custom family.
  return /Ionicons|MaterialIcons|MaterialCommunityIcons|FontAwesome|Entypo|Feather|Octicons|SimpleLineIcons|lucide/i.test(
    f
  );
}

export function installGlobalTypographyWeightNormalizer() {
  const g = globalThis as unknown as { __budgetAppWeightNormalizerInstalled?: boolean };
  if (g.__budgetAppWeightNormalizerInstalled) return;
  g.__budgetAppWeightNormalizerInstalled = true;

  const setStyleAttributePreprocessor = (StyleSheet as any).setStyleAttributePreprocessor;
  if (typeof setStyleAttributePreprocessor === "function") {
    try {
      setStyleAttributePreprocessor("fontWeight", normalizeWeightValue);
    } catch {
      // no-op
    }
  }

  (Text as any).defaultProps = (Text as any).defaultProps || {};
  (Text as any).defaultProps.style = [
    (Text as any).defaultProps.style,
    { fontWeight: "400" },
  ];

  (TextInput as any).defaultProps = (TextInput as any).defaultProps || {};
  (TextInput as any).defaultProps.style = [
    (TextInput as any).defaultProps.style,
    { fontWeight: "400" },
  ];

  const oldTextRender = (Text as any).render;
  (Text as any).render = function render(...args: any[]) {
    const origin = oldTextRender.call(this, ...args);
    const flat = StyleSheet.flatten(origin?.props?.style);
    const existingFamily = (flat as any)?.fontFamily;
    if (existingFamily && shouldSkipFontOverride(existingFamily)) return origin;
    const normalizedWeight = normalizeToLighterWeight((flat as any)?.fontWeight);
    if (!normalizedWeight) return origin;

    return React.cloneElement(origin, {
      ...origin.props,
      style: [origin.props.style, { fontWeight: normalizedWeight }],
    });
  };

  const oldTextInputRender = (TextInput as any).render;
  if (typeof oldTextInputRender === "function") {
    (TextInput as any).render = function render(...args: any[]) {
      const origin = oldTextInputRender.call(this, ...args);
      const flat = StyleSheet.flatten(origin?.props?.style);
      const existingFamily = (flat as any)?.fontFamily;
      if (existingFamily && shouldSkipFontOverride(existingFamily)) return origin;

      const normalizedWeight = normalizeToLighterWeight((flat as any)?.fontWeight);
      if (!normalizedWeight) return origin;

      return React.cloneElement(origin, {
        ...origin.props,
        style: [origin.props.style, { fontWeight: normalizedWeight }],
      });
    };
  }
}
