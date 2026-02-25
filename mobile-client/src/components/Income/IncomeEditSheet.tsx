import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { T } from "@/lib/theme";
import { cardBase } from "@/lib/ui";

const SCREEN_W = Dimensions.get("window").width;

type Props = {
  visible: boolean;
  name: string;
  amount: string;
  currency: string;
  totalIncome: number;
  setName: (value: string) => void;
  setAmount: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
  isLocked: boolean;
};

// Line chart showing percentage of total income with smooth curve + area fill
function PctChart({ pct }: { pct: number | null }) {
  const W = SCREEN_W - 40;
  const H = 110;
  const PAD_L = 28;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 22;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const target = pct !== null ? Math.min(100, Math.max(0, pct)) : 0;

  // Generate 9 points that build toward the target with slight organic variation
  const rawPoints = useMemo(() => {
    const seed = [0.05, 0.18, 0.28, 0.42, 0.52, 0.63, 0.74, 0.87, 1.0];
    const noise = [0, 0.06, 0.03, -0.05, 0.04, -0.03, 0.05, -0.02, 0];
    return seed.map((t, i) => ({
      x: PAD_L + t * chartW,
      y: PAD_T + chartH - Math.max(0, Math.min(1, t + noise[i]!)) * (target / 100) * chartH,
    }));
  }, [target, chartW, chartH, PAD_L, PAD_T]);

  // Build smooth cubic bezier path
  const linePath = useMemo(() => {
    if (rawPoints.length < 2) return "";
    let d = `M ${rawPoints[0]!.x} ${rawPoints[0]!.y}`;
    for (let i = 1; i < rawPoints.length; i++) {
      const prev = rawPoints[i - 1]!;
      const curr = rawPoints[i]!;
      const cpx = (prev.x + curr.x) / 2;
      d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  }, [rawPoints]);

  // Area path = line + close down to baseline
  const areaPath = useMemo(() => {
    if (!linePath) return "";
    const baseY = PAD_T + chartH;
    const firstX = rawPoints[0]!.x;
    const lastX = rawPoints[rawPoints.length - 1]!.x;
    return `${linePath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  }, [linePath, rawPoints, PAD_T, chartH]);

  const lastPt = rawPoints[rawPoints.length - 1]!;
  const baseY = PAD_T + chartH;

  return (
    <View style={s.chartWrap}>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={T.accent} stopOpacity="0.28" />
            <Stop offset="1" stopColor={T.accent} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {/* Horizontal grid lines at 25%, 50%, 75%, 100% */}
        {[0.25, 0.5, 0.75, 1.0].map((v) => {
          const y = PAD_T + chartH - v * chartH;
          return (
            <Line
              key={v}
              x1={PAD_L}
              y1={y}
              x2={W - PAD_R}
              y2={y}
              stroke={T.border}
              strokeWidth={0.8}
              strokeDasharray="3,4"
            />
          );
        })}

        {/* Y-axis labels */}
        {[25, 50, 75, 100].map((v) => {
          const y = PAD_T + chartH - (v / 100) * chartH;
          return (
            <SvgText key={v} x={PAD_L - 4} y={y + 4} fontSize={8} fill={T.textMuted} textAnchor="end">
              {v}%
            </SvgText>
          );
        })}

        {/* Area fill */}
        {target > 0 && <Path d={areaPath} fill="url(#areaGrad)" />}

        {/* Baseline */}
        <Line x1={PAD_L} y1={baseY} x2={W - PAD_R} y2={baseY} stroke={T.border} strokeWidth={1} />

        {/* Line */}
        {target > 0 && (
          <Path d={linePath} stroke={T.accent} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* End dot */}
        {target > 0 && (
          <>
            <Circle cx={lastPt.x} cy={lastPt.y} r={5} fill={T.accent} />
            <Circle cx={lastPt.x} cy={lastPt.y} r={8} fill={T.accent} fillOpacity={0.2} />
          </>
        )}
      </Svg>

      {pct !== null && (
        <View style={s.chartFooter}>
          <Text style={s.chartPct}>{pct}%</Text>
          <Text style={s.chartSub}> of total income</Text>
        </View>
      )}
    </View>
  );
}

export default function IncomeEditSheet({
  visible,
  name,
  amount,
  currency,
  totalIncome,
  setName,
  setAmount,
  onCancel,
  onSave,
  onDelete,
  saving,
  isLocked,
}: Props) {
  // Two-mode sheet: view (read-only) → tap Edit → edit (inputs active)
  const [editMode, setEditMode] = useState(false);

  // Store originals when entering edit mode so Cancel can restore them
  const originalName   = useRef(name);
  const originalAmount = useRef(amount);
  const amountRef = useRef<TextInput>(null);

  // Reset to view mode whenever the sheet closes or a new item opens
  useEffect(() => {
    if (!visible) {
      setEditMode(false);
    }
  }, [visible]);

  const enterEdit = () => {
    originalName.current   = name;
    originalAmount.current = amount;
    setEditMode(true);
    // Slight delay so the input is rendered before we focus
    setTimeout(() => amountRef.current?.focus(), 80);
  };

  const cancelEdit = () => {
    // Restore values to what they were before editing
    setName(originalName.current);
    setAmount(originalAmount.current);
    setEditMode(false);
  };

  const pct = useMemo(() => {
    const val = parseFloat(String(amount).replace(/,/g, ""));
    if (!isFinite(val) || totalIncome <= 0) return null;
    return Math.round((val / totalIncome) * 100);
  }, [amount, totalIncome]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onCancel}
    >
      <View style={s.overlay}>
        <View style={s.sheet}>
          <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <View style={s.handle} />

              <View style={s.content}>
                {/* Name — static text in view mode, input in edit mode */}
                {editMode ? (
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    editable={!saving}
                    placeholder="Name"
                    placeholderTextColor={T.textMuted}
                    style={s.nameInput}
                  />
                ) : (
                  <Text style={s.nameText} numberOfLines={1}>{name}</Text>
                )}

                {/* Amount — static in view, editable in edit */}
                <View style={s.amountArea}>
                  <View style={s.amountRow}>
                    <Text style={s.currencySign}>{currency}</Text>
                    {editMode ? (
                      <TextInput
                        ref={amountRef}
                        value={amount}
                        onChangeText={setAmount}
                        editable={!saving}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={`${T.text}33`}
                        style={s.amountInput}
                        returnKeyType="done"
                        onSubmitEditing={() => { if (!saving) onSave(); }}
                      />
                    ) : (
                      <Text style={s.amountStatic}>{amount}</Text>
                    )}
                  </View>
                </View>

                {/* ① Edit / Delete — visible in view mode only */}
                {!isLocked && !editMode && (
                  <View style={s.actionRow}>
                    <Pressable
                      onPress={enterEdit}
                      disabled={saving}
                      style={[s.pill, s.pillEdit, saving && s.disabled]}
                    >
                      <Ionicons name="pencil-outline" size={15} color={T.textDim} />
                      <Text style={s.pillEditText}>Edit</Text>
                    </Pressable>

                    <Pressable
                      onPress={onDelete}
                      disabled={saving}
                      style={[s.pill, s.pillDelete, saving && s.disabled]}
                    >
                      <Ionicons name="trash-outline" size={15} color={T.red} />
                      <Text style={s.pillDeleteText}>Delete</Text>
                    </Pressable>
                  </View>
                )}

                {/* ② Percentage line chart */}
                <PctChart pct={pct} />

                {/* ③ Cancel / Save — always visible */}
                <View style={s.actionRow}>
                  <Pressable
                    onPress={editMode ? cancelEdit : onCancel}
                    disabled={saving}
                    style={[s.pill, s.pillCancel, saving && s.disabled]}
                  >
                    <Text style={s.cancelText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={onSave}
                    disabled={!editMode || saving}
                    style={[s.pill, s.pillSave, (!editMode || saving) && s.disabled]}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={T.onAccent} />
                    ) : (
                      <Text style={s.saveText}>Save</Text>
                    )}
                  </Pressable>
                </View>

                <View style={{ flex: 1 }} />
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1 },
  sheet: {
    flex: 1,
    backgroundColor: T.bg,
    borderTopWidth: 1,
    borderTopColor: T.accentBorder,
  },
  safe: { flex: 1 },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    backgroundColor: T.border,
    marginTop: 10,
    marginBottom: 6,
  },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },

  nameInput: {
    ...cardBase,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: T.text,
    fontSize: 18,
    fontWeight: "800",
    backgroundColor: T.card,
  },
  nameText: {
    ...cardBase,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: T.text,
    fontSize: 18,
    fontWeight: "800",
    backgroundColor: T.card,
  },

  /* Amount — no panel, sits on raw background */
  amountArea: {
    marginTop: 28,
    alignItems: "center",
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  currencySign: {
    color: T.accent,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 8,
    marginRight: 2,
    lineHeight: 44,
  },
  amountInput: {
    color: T.text,
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: -2,
    minWidth: 80,
    textAlign: "center",
    padding: 0,
  },
  amountStatic: {
    color: T.text,
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: -2,
    textAlign: "center",
  },

  /* Shared action row */
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    paddingVertical: 13,
    borderWidth: 1,
  },
  pillEdit:   { backgroundColor: T.card,             borderColor: T.border },
  pillDelete: { backgroundColor: `${T.red}14`,        borderColor: `${T.red}55` },
  pillCancel: { backgroundColor: T.card,             borderColor: T.border },
  pillSave:   { backgroundColor: T.accent,           borderColor: T.accentBorder },

  pillEditText:   { color: T.textDim,  fontSize: 14, fontWeight: "700" },
  pillDeleteText: { color: T.red,      fontSize: 14, fontWeight: "700" },
  cancelText:     { color: T.textDim,  fontSize: 15, fontWeight: "800" },
  saveText:       { color: T.onAccent, fontSize: 15, fontWeight: "900" },

  /* Chart */
  chartWrap:       { marginTop: 22 },
  chartFooter:     { flexDirection: "row", alignItems: "baseline", marginTop: 2, paddingLeft: 28 },
  chartPct:        { color: T.accent,   fontSize: 13, fontWeight: "800" },
  chartSub:        { color: T.textDim,  fontSize: 11, fontWeight: "600" },

  disabled:      { opacity: 0.55 },
  disabledInput: { opacity: 0.7 },
});
