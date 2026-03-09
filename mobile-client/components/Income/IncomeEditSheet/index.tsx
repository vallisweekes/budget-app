import React, { useMemo, useState, useEffect, useRef } from "react";
import { ActivityIndicator, Animated, Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import Svg, { Path, Line, Circle, Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";

import { T } from "@/lib/theme";
import MoneyInput from "@/components/Shared/MoneyInput";
import { useSwipeDownToClose } from "@/lib/hooks/useSwipeDownToClose";
import type { IncomeEditSheetPctChartProps, IncomeEditSheetProps } from "@/types";

const SCREEN_W = Dimensions.get("window").width;

// Line chart showing percentage of total income with smooth curve + area fill
function PctChart({ pct }: IncomeEditSheetPctChartProps) {
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
    <View style={styles.chartWrap}>
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
        <View style={styles.chartFooter}>
          <Text style={styles.chartPct}>{pct}%</Text>
          <Text style={styles.chartSub}> of total income</Text>
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
}: IncomeEditSheetProps) {
  // Two-mode sheet: view (read-only) → tap Edit → edit (inputs active)
  const [editMode, setEditMode] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Store originals when entering edit mode so Cancel can restore them
  const originalName   = useRef(name);
  const originalAmount = useRef(amount);
  const amountRef = useRef<TextInput>(null);

  // Reset to view mode whenever the sheet closes or a new item opens
  useEffect(() => {
    if (!visible) {
      setEditMode(false);
      setDeleteConfirm(false);
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

  const { dragY, panHandlers } = useSwipeDownToClose({ onClose: onCancel, disabled: saving });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: dragY }] }]}>
          <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <View style={styles.handle} {...panHandlers} />

              <View style={styles.content}>
                {/* Name — input in edit mode only */}
                {editMode && (
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    editable={!saving}
                    placeholder="Name"
                    placeholderTextColor={T.textMuted}
                    style={styles.nameInput}
                  />
                )}

                {/* Amount — static in view, editable in edit */}
                <View style={styles.amountArea}>
                  {!editMode && (
                    <Text style={styles.nameLabel} numberOfLines={1}>{name}</Text>
                  )}
                  <View style={styles.amountRow}>
                    {editMode ? (
                      <MoneyInput
                        currency={currency}
                        value={amount}
                        onChangeValue={setAmount}
                        placeholder="0.00"
                        editable={!saving}
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          if (!saving) onSave();
                        }}
                        containerStyle={{ width: 320 }}
                        inputStyle={{ fontSize: 24 }}
                      />
                    ) : (
                      <>
                        <Text style={styles.currencySign}>{currency}</Text>
                        <Text style={styles.amountStatic}>{amount}</Text>
                      </>
                    )}
                  </View>
                </View>

                {/* ① Edit / Delete — visible in view mode only */}
                {!isLocked && !editMode && !deleteConfirm && (
                  <View style={[styles.actionRow, styles.topActionRow]}>
                    <Pressable
                      onPress={enterEdit}
                      disabled={saving}
                      style={[styles.pill, styles.pillEdit, saving && styles.disabled]}
                    >
                      <Ionicons name="pencil-outline" size={15} color={T.textDim} />
                      <Text style={styles.pillEditText}>Edit</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => setDeleteConfirm(true)}
                      disabled={saving}
                      style={[styles.pill, styles.pillDelete, saving && styles.disabled]}
                    >
                      <Ionicons name="trash-outline" size={15} color={T.red} />
                      <Text style={styles.pillDeleteText}>Delete</Text>
                    </Pressable>
                  </View>
                )}

                {/* ① Delete confirmation — replaces action row */}
                {deleteConfirm && (
                  <View style={styles.confirmCard}>
                    <Ionicons name="warning-outline" size={22} color={T.red} style={{ marginBottom: 8 }} />
                    <Text style={styles.confirmTitle}>Delete income source?</Text>
                    <Text style={styles.confirmSub}>This action cannot be undone.</Text>
                    <View style={[styles.actionRow, { marginTop: 16 }]}>
                      <Pressable
                        onPress={() => setDeleteConfirm(false)}
                        disabled={saving}
                        style={[styles.pill, styles.pillCancel, saving && styles.disabled]}
                      >
                        <Text style={styles.cancelText}>Keep</Text>
                      </Pressable>
                      <Pressable
                        onPress={onDelete}
                        disabled={saving}
                        style={[styles.pill, styles.pillDelete, saving && styles.disabled]}
                      >
                        {saving ? (
                          <ActivityIndicator size="small" color={T.red} />
                        ) : (
                          <>
                            <Ionicons name="trash-outline" size={15} color={T.red} />
                            <Text style={styles.pillDeleteText}>Yes, delete</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* ② Percentage line chart */}
                <PctChart pct={pct} />

                {/* ③ Cancel / Save — always visible */}
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={editMode ? cancelEdit : onCancel}
                    disabled={saving}
                    style={[styles.pill, styles.pillCancel, saving && styles.disabled]}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    onPress={onSave}
                    disabled={!editMode || saving}
                    style={[styles.pill, styles.pillSave, (!editMode || saving) && styles.disabled]}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={T.onAccent} />
                    ) : (
                      <Text style={styles.saveText}>Save</Text>
                    )}
                  </Pressable>
                </View>

                <View style={{ flex: 1 }} />
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}
