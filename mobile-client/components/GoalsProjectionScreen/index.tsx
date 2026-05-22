import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Polyline, Stop } from "react-native-svg";

import type { DashboardData } from "@/lib/apiTypes";
import { useBootstrapData } from "@/context/BootstrapDataContext";
import { currencySymbol, fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";

import { buildGoalsProjection } from "./projection";
import ScenarioSlider from "./ScenarioSlider";
import { styles } from "./style";
const CHART_WIDTH = 320;
const CHART_HEIGHT = 220;
const CHART_TOP = 18;
const CHART_BOTTOM = 168;

function getChartY(value: number, maxY: number) {
  const usableHeight = CHART_BOTTOM - CHART_TOP;
  return CHART_BOTTOM - (value / maxY) * usableHeight;
}

function fmtCompactCurrency(value: number, currency?: string) {
  const sym = currencySymbol(currency);
  const absolute = Math.abs(value);

  if (absolute >= 1_000_000) {
    const millions = absolute / 1_000_000;
    const compact = millions >= 10 ? Math.round(millions).toString() : millions.toFixed(1).replace(/\.0$/, "");
    return `${value < 0 ? "-" : ""}${sym}${compact}m`;
  }

  if (absolute >= 1_000) {
    const thousands = absolute / 1_000;
    const compact = thousands >= 10 ? Math.round(thousands).toString() : thousands.toFixed(1).replace(/\.0$/, "");
    return `${value < 0 ? "-" : ""}${sym}${compact}k`;
  }

  return `${value < 0 ? "-" : ""}${sym}${Math.round(absolute)}`;
}

export default function GoalsProjectionScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(0, insets.top);
  const { dashboard: bootstrapDashboard, settings, ensureLoaded, refresh: refreshBootstrap } = useBootstrapData();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [isScenarioSliding, setIsScenarioSliding] = useState(false);

  const load = useCallback(async (options?: { force?: boolean }) => {
    try {
      setError(null);
      const next = options?.force ? await refreshBootstrap({ force: true }) : await ensureLoaded();
      const dash = next.dashboard ?? bootstrapDashboard;
      if (!dash) throw new Error("Failed to load projection");
      setDashboard(dash);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load projection");
    } finally {
      setLoading(false);
    }
  }, [bootstrapDashboard, ensureLoaded, refreshBootstrap]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const baseProjection = useMemo(() => buildGoalsProjection(dashboard, settings), [dashboard, settings]);
  const currentPlanMonthly = baseProjection?.monthlyTotal ?? 0;
  const effectiveScenarioMonthly = selectedScenario ?? currentPlanMonthly;
  const scenarioMax = useMemo(
    () => Math.max(500, Math.ceil((currentPlanMonthly + 200) / 50) * 50),
    [currentPlanMonthly],
  );
  const isCurrentScenario = selectedScenario == null || Math.abs(effectiveScenarioMonthly - currentPlanMonthly) < 1;
  const projection = useMemo(
    () => (isCurrentScenario
      ? baseProjection
      : buildGoalsProjection(dashboard, settings, { scenarioMonthlyTotal: effectiveScenarioMonthly })),
    [baseProjection, dashboard, effectiveScenarioMonthly, isCurrentScenario, settings],
  );
  const currency = settings?.currency ?? undefined;
  const yTicks = useMemo(() => {
    if (!projection) return [];
    return [1, 0.66, 0.33, 0].map((fraction) => Math.round(projection.maxY * fraction));
  }, [projection]);
  const scenarioDelta = projection && baseProjection ? projection.totalProjected - baseProjection.totalProjected : 0;
  const scenarioLabel = isCurrentScenario ? "Current plan" : `${fmt(effectiveScenarioMonthly, currency)}/mo`;
  const startYearLabel = String(new Date().getFullYear());
  const endYearLabel = projection?.endYear ? String(projection.endYear) : "Target year";
  const midYearLabel = projection?.endYear ? String(Math.max(new Date().getFullYear(), Math.round((new Date().getFullYear() + projection.endYear) / 2))) : "Midpoint";
  const projectionRange = projection?.endYear ? `${startYearLabel} - ${endYearLabel}` : `Now - ${endYearLabel}`;

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { paddingTop: topInset + 16 }]} edges={["bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={T.accent} />
          <Text style={styles.stateText}>Loading projection…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.safe, { paddingTop: topInset + 16 }]} edges={["bottom"]}>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={T.textDim} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load({ force: true })} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={[styles.header, { paddingTop: topInset + 6 }]}> 
        <BlurView intensity={14} tint="dark" style={styles.headerBlur} pointerEvents="none" />
        <View style={styles.headerGlassTint} pointerEvents="none" />
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={T.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Goals projection</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scroll, { paddingTop: topInset + 56 }]}
        scrollEnabled={!isScenarioSliding}
        showsVerticalScrollIndicator={false}
      >
        {projection ? (
          <>
            <View style={styles.chartCard}>
              <View style={styles.chartHeaderRow}>
                <View style={styles.chartTitleBlock}>
                  <Text style={styles.chartEyebrow}>Projection curve</Text>
                  <Text style={styles.chartTitle}>Goal trajectory</Text>
                  <Text style={styles.chartSubtitle}>{`Projected balances through ${endYearLabel}`}</Text>
                </View>
                <View style={styles.chartPill}>
                  <Text style={styles.chartPillText}>{scenarioLabel}</Text>
                </View>
              </View>

              <View style={styles.chartShell}>
                <View style={styles.yAxisCol}>
                  {yTicks.map((tick, index) => (
                    <Text key={`${tick}-${index}`} style={styles.yAxisTxt}>
                      {fmtCompactCurrency(tick, currency)}
                    </Text>
                  ))}
                </View>

                <View style={styles.chartCanvasWrap}>
                  <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none">
                    <Defs>
                      {projection.lines.map((line) => (
                        <LinearGradient key={line.id} id={`goal-grad-${line.id}`} x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0%" stopColor={line.areaTop} />
                          <Stop offset="100%" stopColor={line.areaBottom} />
                        </LinearGradient>
                      ))}
                    </Defs>

                    {yTicks.map((tick, index) => {
                      const y = getChartY(tick, projection.maxY);
                      return (
                        <Line
                          key={`grid-${tick}-${index}`}
                          x1="0"
                          x2={String(CHART_WIDTH)}
                          y1={String(y)}
                          y2={String(y)}
                          stroke={index === yTicks.length - 1 ? T.border : "rgba(244,246,255,0.08)"}
                          strokeDasharray={index === yTicks.length - 1 ? "0" : "4 6"}
                          strokeWidth="1"
                        />
                      );
                    })}

                    {projection.lines.map((line) => {
                      const coordinates = line.points.map((point, index) => {
                        const x = (index / projection.months) * CHART_WIDTH;
                        const y = getChartY(point, projection.maxY);
                        return { x, y };
                      });

                      const polyline = coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
                      const areaPath = [
                        `M 0 ${CHART_BOTTOM}`,
                        ...coordinates.map(({ x, y }) => `L ${x.toFixed(1)} ${y.toFixed(1)}`),
                        `L ${CHART_WIDTH} ${CHART_BOTTOM}`,
                        "Z",
                      ].join(" ");
                      const lastPoint = coordinates[coordinates.length - 1] ?? { x: CHART_WIDTH, y: CHART_BOTTOM };

                      return (
                        <React.Fragment key={line.id}>
                          <Path d={areaPath} fill={`url(#goal-grad-${line.id})`} />
                          <Polyline
                            points={polyline}
                            fill="none"
                            stroke={line.color}
                            strokeWidth={3}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                          />
                          <Line
                            x1={String(lastPoint.x)}
                            y1={String(lastPoint.y)}
                            x2={String(lastPoint.x)}
                            y2={String(CHART_BOTTOM)}
                            stroke={line.color}
                            strokeOpacity="0.18"
                            strokeWidth="1"
                            strokeDasharray="3 5"
                          />
                          <Circle cx={String(lastPoint.x)} cy={String(lastPoint.y)} r="16" fill={line.color} opacity="0.10" />
                          <Circle cx={String(lastPoint.x)} cy={String(lastPoint.y)} r="10" fill={line.color} opacity="0.16" />
                          <Circle cx={String(lastPoint.x)} cy={String(lastPoint.y)} r="5.5" fill={T.bg} stroke={line.color} strokeWidth="2.2" />
                          <Circle cx={String(lastPoint.x)} cy={String(lastPoint.y)} r="2.8" fill={line.color} />
                        </React.Fragment>
                      );
                    })}
                  </Svg>
                </View>
              </View>

              <View style={styles.axisRow}>
                <Text style={styles.axisTxt}>Now</Text>
                <Text style={styles.axisTxt}>{midYearLabel}</Text>
                <Text style={styles.axisTxt}>{endYearLabel}</Text>
              </View>

              <View style={styles.chartRangeRow}>
                <Text style={styles.chartRangeLabel}>Projection range</Text>
                <Text style={styles.chartRangeValue}>{projectionRange}</Text>
              </View>

              <View style={styles.legendRow}>
                {projection.lines.map((line) => (
                  <View key={line.id} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: line.color }]} />
                    <Text style={styles.legendTxt}>{line.title}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.heroCard}>
              <View style={styles.heroCopy}>
                <Text style={styles.eyebrow}>Forecast</Text>
                <Text style={styles.heroTitle}>{`Projected by ${endYearLabel}`}</Text>
                <Text style={styles.heroText}>
                  {fmt(projection.totalProjected, currency)} across your active goals.
                </Text>
                {selectedScenario != null && baseProjection ? (
                  <Text style={styles.heroScenarioNote}>
                    <Text style={scenarioDelta >= 0 ? styles.heroScenarioPositive : styles.heroScenarioNegative}>
                      {scenarioDelta >= 0 ? `+${fmt(scenarioDelta, currency)}` : fmt(scenarioDelta, currency)}
                    </Text>
                    {" vs current plan"}
                  </Text>
                ) : (
                  <Text style={styles.heroScenarioNote}>Adjust the slider to compare scenarios.</Text>
                )}
              </View>

              <View style={styles.scenarioWrap}>
                <ScenarioSlider
                  label="Per month"
                  min={0}
                  max={scenarioMax}
                  step={10}
                  value={effectiveScenarioMonthly}
                  baselineValue={currentPlanMonthly}
                  currency={currency}
                  tickValues={[0, 50, 100, 150, 200, 500].filter((tick) => tick <= scenarioMax)}
                  onSlidingChange={setIsScenarioSliding}
                  onChange={setSelectedScenario}
                />
              </View>

              <View style={styles.metricGrid}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Saved now</Text>
                  <Text style={styles.metricValue}>{fmt(projection.totalCurrent, currency)}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Monthly pace</Text>
                  <Text style={styles.metricValue}>{fmt(projection.monthlyTotal, currency)}</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>On track</Text>
                  <Text style={styles.metricValue}>{`${projection.onTrackCount}/${projection.lines.length}`}</Text>
                </View>
              </View>
            </View>

            <View style={styles.outlookSectionHeader}>
              <Text style={styles.outlookTitle}>Goal outlook</Text>
              <Text style={styles.outlookCaption}>{projection.lines.length} active tracks</Text>
            </View>

            {projection.lines.map((line) => (
              <View key={line.id} style={styles.goalCard}>
                <View pointerEvents="none" style={[styles.goalCardGlow, { backgroundColor: `${line.color}16` }]} />
                <View pointerEvents="none" style={styles.goalCardInnerBorder} />
                <View style={styles.goalCardTopRow}>
                  <View style={styles.goalCardTitleWrap}>
                    <View style={[styles.goalSwatch, { backgroundColor: line.color }]} />
                    <View>
                      <Text style={styles.goalCardTitle}>{line.title}</Text>
                      <Text style={styles.goalCardSubtitle}>{line.label}</Text>
                    </View>
                  </View>

                  <View style={[styles.statusPill, { borderColor: `${line.color}40`, backgroundColor: `${line.color}14` }]}>
                    <Text style={[styles.statusPillText, { color: line.color }]}>{line.statusLabel}</Text>
                  </View>
                </View>

                <View style={styles.progressMetaRow}>
                  <Text style={styles.progressMetaLabel}>Now {fmt(line.current, currency)}</Text>
                  <Text style={styles.progressMetaLabel}>{`By ${line.label.replace("Target ", "")} ${fmt(line.projectedEnd, currency)}`}</Text>
                </View>

                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarNow,
                      { width: `${Math.max(4, line.progressNow * 100)}%`, backgroundColor: line.color },
                    ]}
                  />
                  <View
                    style={[
                      styles.progressBarProjected,
                      { width: `${Math.max(line.progressNow * 100, line.progressProjected * 100)}%`, borderColor: line.color },
                    ]}
                  />
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statBlock}>
                    <Text style={styles.statLabel}>Monthly</Text>
                    <Text style={styles.statValue}>{line.monthly > 0 ? fmt(line.monthly, currency) : "Not set"}</Text>
                  </View>
                  <View style={styles.statBlock}>
                    <Text style={styles.statLabel}>Remaining</Text>
                    <Text style={styles.statValue}>{line.target > 0 ? fmt(line.remaining, currency) : "Open target"}</Text>
                  </View>
                  <View style={styles.statBlock}>
                    <Text style={styles.statLabel}>ETA</Text>
                    <Text style={styles.statValue}>{line.etaLabel ?? "No forecast"}</Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="trending-up-outline" size={20} color={T.accent} />
            </View>
            <Text style={styles.emptyTitle}>No projection data yet</Text>
            <Text style={styles.emptyDetail}>Set up savings, emergency, or investment goals with target amounts and monthly contributions to unlock your forecast.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
