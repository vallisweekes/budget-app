import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, PanResponder, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as LucideIcons from "lucide-react-native";

import { resolveCategoryColor, withOpacity } from "@/lib/categoryColors";
import { fmt } from "@/lib/formatting";
import { T } from "@/lib/theme";
import { loggedExpensesStyles as s } from "@/components/LoggedExpensesScreen/style";
import type { LoggedExpenseCardCategoryIconProps, LoggedExpenseCardProps } from "@/types";

const SWIPE_ACTION_WIDTH = 56;
const SWIPE_OPEN_THRESHOLD = 24;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function CategoryIcon({ name, color }: LoggedExpenseCardCategoryIconProps) {
  const Icon = name
    ? ((LucideIcons as Record<string, unknown>)[name] as
        | React.ComponentType<{ size: number; color: string; strokeWidth?: number }>
        | undefined)
    : undefined;

  return (
    <View style={[s.iconWrap, { backgroundColor: withOpacity(color, 0.13) }]}>
      {Icon ? <Icon size={18} color={color} strokeWidth={2} /> : <View style={[s.iconDot, { backgroundColor: color }]} />}
    </View>
  );
}

export default function LoggedExpenseCard(props: LoggedExpenseCardProps) {
  const [swipeOpen, setSwipeOpen] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const currentXRef = useRef(0);
  const gestureStartXRef = useRef(0);

  useEffect(() => {
    const listener = translateX.addListener(({ value }) => {
      currentXRef.current = value;
    });

    return () => {
      translateX.removeListener(listener);
    };
  }, [translateX]);

  const animateToX = useCallback((target: number) => {
    Animated.spring(translateX, {
      toValue: target,
      useNativeDriver: true,
      damping: 24,
      stiffness: 260,
      mass: 0.9,
      overshootClamping: true,
    }).start();
  }, [translateX]);

  const closeSwipe = useCallback((animated = true) => {
    setSwipeOpen(false);
    if (animated) {
      animateToX(0);
      return;
    }
    translateX.setValue(0);
    currentXRef.current = 0;
  }, [animateToX, translateX]);

  const openSwipe = useCallback(() => {
    setSwipeOpen(true);
    animateToX(SWIPE_ACTION_WIDTH);
  }, [animateToX]);

  useEffect(() => {
    if (!props.deleting) return;
    openSwipe();
  }, [openSwipe, props.deleting]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gestureState) => {
        if (props.deleting) return false;
        return Math.abs(gestureState.dx) > Math.abs(gestureState.dy) && Math.abs(gestureState.dx) > 6;
      },
      onPanResponderGrant: () => {
        gestureStartXRef.current = currentXRef.current;
      },
      onPanResponderMove: (_event, gestureState) => {
        const next = clamp(gestureStartXRef.current + gestureState.dx, 0, SWIPE_ACTION_WIDTH);
        translateX.setValue(next);
      },
      onPanResponderRelease: (_event, gestureState) => {
        const next = clamp(gestureStartXRef.current + gestureState.dx, 0, SWIPE_ACTION_WIDTH);
        if (next >= SWIPE_OPEN_THRESHOLD || gestureState.vx > 0.45) {
          openSwipe();
          return;
        }
        closeSwipe();
      },
      onPanResponderTerminate: () => {
        if (currentXRef.current >= SWIPE_OPEN_THRESHOLD) {
          openSwipe();
          return;
        }
        closeSwipe();
      },
      onPanResponderTerminationRequest: () => false,
    }),
    [closeSwipe, openSwipe, props.deleting, translateX],
  );

  const deleteActionOpacity = useMemo(
    () => translateX.interpolate({
      inputRange: [0, 6, SWIPE_ACTION_WIDTH],
      outputRange: [0, 0, 1],
      extrapolate: "clamp",
    }),
    [translateX],
  );

  const handlePress = useCallback(() => {
    if (swipeOpen || currentXRef.current > 8) {
      closeSwipe();
      return;
    }

    props.onPress(props.item);
  }, [closeSwipe, props, swipeOpen]);

  const handleDelete = useCallback(() => {
    if (props.deleting) return;
    props.onDelete(props.item);
  }, [props]);

  return (
    <View style={s.swipeOuter}>
      <Animated.View style={[s.deleteActionWrap, { opacity: deleteActionOpacity }]} pointerEvents={swipeOpen ? "auto" : "none"}>
        <Pressable
          style={({ pressed }) => [s.deleteActionBtn, pressed && !props.deleting && s.deleteActionBtnPressed]}
          onPress={handleDelete}
          disabled={Boolean(props.deleting)}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${props.item.name}`}
        >
          {props.deleting ? (
            <ActivityIndicator size="small" color={T.onAccent} />
          ) : (
            <Ionicons name="trash-outline" size={20} color={T.onAccent} />
          )}
        </Pressable>
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <Pressable
          style={({ pressed }) => [s.card, pressed && s.cardPressed]}
          onPress={handlePress}
        >
          <View style={s.topRow}>
            <View style={s.left}>
              <CategoryIcon name={props.item.category?.icon} color={resolveCategoryColor(props.categoryColor ?? props.item.category?.color ?? null)} />
              <Text style={s.rowName} numberOfLines={1}>{props.item.name}</Text>
            </View>
            <View style={s.right}>
              <Text style={s.rowAmount}>{fmt(Number(props.item.amount), props.currency)}</Text>
              <Ionicons name="chevron-forward" size={16} color={T.textMuted} />
            </View>
          </View>

          <Text style={s.rowMeta}>
            {(props.item.category?.name ?? props.categoryName ?? "Uncategorised")} · {String(props.item.paymentSource ?? "").replace("_", " ")}
          </Text>

          <View style={s.track}>
            <View style={[s.fill, { width: "100%", backgroundColor: resolveCategoryColor(props.categoryColor ?? props.item.category?.color ?? null) }]} />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}