import { useMemo, useRef } from "react";
import { Animated, PanResponder, Platform } from "react-native";

type Options = {
  onClose: () => void;
  disabled?: boolean;
  /** Drag distance in px required to close. Default: 120 */
  closeThreshold?: number;
  /** Quick swipe velocity required to close. Default: 1.2 */
  velocityThreshold?: number;
};

export function useSwipeDownToClose({
  onClose,
  disabled = false,
  closeThreshold = 120,
  velocityThreshold = 1.2,
}: Options) {
  const dragY = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);

  const resetDrag = useMemo(
    () =>
      () => {
        closingRef.current = false;
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          // a slightly snappier return on iOS
          speed: Platform.OS === "ios" ? 22 : 18,
          bounciness: 0,
        }).start();
      },
    [dragY]
  );

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        if (disabled) return false;
        if (closingRef.current) return false;
        const { dx, dy } = gestureState;
        return dy > 6 && Math.abs(dx) < 24;
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (disabled) return;
        if (closingRef.current) return;
        const next = Math.max(0, gestureState.dy);
        dragY.setValue(next);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (disabled) return;
        if (closingRef.current) return;

        const { dy, vy } = gestureState;
        const shouldClose = dy > closeThreshold || vy > velocityThreshold;

        if (!shouldClose) {
          resetDrag();
          return;
        }

        closingRef.current = true;
        Animated.timing(dragY, {
          toValue: Math.max(closeThreshold * 2, dy),
          duration: 140,
          useNativeDriver: true,
        }).start(() => {
          // Ensure next open starts at 0
          dragY.setValue(0);
          closingRef.current = false;
          onClose();
        });
      },
      onPanResponderTerminate: () => {
        if (disabled) return;
        if (closingRef.current) return;
        resetDrag();
      },
    });
  }, [closeThreshold, disabled, dragY, onClose, resetDrag, velocityThreshold]);

  return {
    dragY,
    panHandlers: panResponder.panHandlers,
    resetDrag,
  };
}
