import { useSafeAreaInsets } from "react-native-safe-area-context";

// When using the transparent/overlay `TopHeader` via React Navigation,
// screens should pad their content by `insets.top + TOP_HEADER_OVERLAY_HEIGHT`
// so first content never renders under the header.
//
// This includes a little extra breathing room for better visual clearance.
export const TOP_HEADER_OVERLAY_HEIGHT = 86;

export function useTopHeaderOffset(extra: number = 0) {
  const insets = useSafeAreaInsets();
  return Math.max(0, insets.top) + TOP_HEADER_OVERLAY_HEIGHT + extra;
}
