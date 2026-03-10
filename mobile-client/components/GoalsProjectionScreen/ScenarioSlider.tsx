import React, { useMemo, useRef, useState } from "react";
import { PanResponder, Text, View, type LayoutChangeEvent } from "react-native";

import { fmt } from "@/lib/formatting";

import { styles } from "./style";

type ScenarioSliderProps = {
  currency?: string;
  label: string;
  valueLabel?: string;
  minLabel?: string;
  maxLabel?: string;
  baselineLabel?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  baselineValue: number;
  tickValues?: number[];
  formatValue?: (value: number) => string;
  onChange: (next: number) => void;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function ScenarioSlider({
  currency,
  label,
  valueLabel,
  minLabel,
  maxLabel,
  baselineLabel,
  min,
  max,
  step,
  value,
  baselineValue,
  tickValues,
  formatValue,
  onChange,
}: ScenarioSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackLeftRef = useRef(0);

  const range = Math.max(1, max - min);
  const ratio = clamp((value - min) / range, 0, 1);
  const baselineRatio = clamp((baselineValue - min) / range, 0, 1);
  const format = (next: number) => (formatValue ? formatValue(next) : fmt(next, currency));

  const updateFromPageX = (pageX: number) => {
    if (trackWidth <= 0) return;
    const relativeX = clamp(pageX - trackLeftRef.current, 0, trackWidth);
    const raw = min + (relativeX / trackWidth) * range;
    const snapped = Math.round(raw / step) * step;
    onChange(clamp(snapped, min, max));
  };

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => updateFromPageX(event.nativeEvent.pageX),
      onPanResponderMove: (event) => updateFromPageX(event.nativeEvent.pageX),
    }),
    [max, min, range, step, trackWidth],
  );

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
    event.currentTarget.measureInWindow((x) => {
      trackLeftRef.current = x;
    });
  };

  return (
    <View style={styles.sliderWrap}>
      <View style={styles.sliderHeaderRow}>
        <Text style={styles.sliderValueLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{valueLabel ?? format(value)}</Text>
      </View>

      <View style={styles.sliderTrackWrap} onLayout={handleTrackLayout} {...panResponder.panHandlers}>
        <View style={styles.sliderTrack} />
        <View style={[styles.sliderTrackFill, { width: `${ratio * 100}%` }]} />
        <View style={[styles.sliderBaselineMarker, { left: `${baselineRatio * 100}%` }]} />
        {tickValues?.map((tick) => {
          const tickRatio = clamp((tick - min) / range, 0, 1);
          return <View key={tick} style={[styles.sliderTick, { left: `${tickRatio * 100}%` }]} />;
        })}
        <View style={[styles.sliderThumb, { left: `${ratio * 100}%` }]} />
      </View>

      <View style={styles.sliderLegendRow}>
        <Text style={styles.sliderLegendText}>{minLabel ?? format(min)}</Text>
        <Text style={styles.sliderLegendText}>{baselineLabel ?? `Current ${format(baselineValue)}`}</Text>
        <Text style={styles.sliderLegendText}>{maxLabel ?? format(max)}</Text>
      </View>
    </View>
  );
}