import { useMemo, useRef } from "react";
import { Animated, Dimensions, Easing, PanResponder, Platform } from "react-native";

type Options = {
  onClose: () => void;
  disabled?: boolean;
  /** Drag distance in px required to close. Default: 120 */
  closeThreshold?: number;
  /** Quick swipe velocity required to close. Default: 1.2 */
  velocityThreshold?: number;
  /** Drag distance before pan responder engages. Default: iOS 3, Android 6 */
  activationDistance?: number;
};

export function useSwipeDownToClose({
  onClose,
  disabled = false,
  closeThreshold = 100,
  velocityThreshold = 0.9,
  activationDistance = Platform.OS === "ios" ? 3 : 6,
}: Options) {
  const { height: SCREEN_H } = Dimensions.get("window");
  const dragY = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);
  const grantDyRef = useRef(0);

  const resetDrag = useMemo(
    () =>
      () => {
        closingRef.current = false;
        grantDyRef.current = 0;
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
    const shouldActivate = (dx: number, dy: number) => {
      if (disabled) return false;
      if (closingRef.current) return false;
      if (dy <= activationDistance) return false;

      // Allow a slightly diagonal downward drag (common when swiping from the top-right)
      // while still rejecting mostly-horizontal gestures.
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx > 140) return false;
      if (absDy < absDx * 1.15) return false;
      return true;
    };

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return shouldActivate(gestureState.dx, gestureState.dy);
      },
      onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
        return shouldActivate(gestureState.dx, gestureState.dy);
      },
      onPanResponderGrant: (_evt, gestureState) => {
        if (disabled) return;
        if (closingRef.current) return;
        // If we only become responder after the user has already dragged (common when
        // nested in scroll views), subtract that initial distance so the sheet doesn't "jump".
        grantDyRef.current = Math.max(0, gestureState.dy);
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (disabled) return;
        if (closingRef.current) return;
        const next = Math.max(0, gestureState.dy - grantDyRef.current);
        dragY.setValue(next);
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (disabled) return;
        if (closingRef.current) return;

        const { vy } = gestureState;
        const dy = Math.max(0, gestureState.dy - grantDyRef.current);
        const shouldClose = dy > closeThreshold || vy > velocityThreshold;

        if (!shouldClose) {
          resetDrag();
          return;
        }

        closingRef.current = true;
        Animated.timing(dragY, {
          toValue: Math.max(SCREEN_H, dy),
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          // Ensure next open starts at 0
          dragY.setValue(0);
          grantDyRef.current = 0;
          closingRef.current = false;
          onClose();
        });
      },
      onPanResponderTerminate: () => {
        if (disabled) return;
        if (closingRef.current) return;
        resetDrag();
      },
      onPanResponderTerminationRequest: () => false,
    });
  }, [SCREEN_H, activationDistance, closeThreshold, disabled, dragY, onClose, resetDrag, velocityThreshold]);

  return {
    dragY,
    panHandlers: panResponder.panHandlers,
    resetDrag,
  };
}
