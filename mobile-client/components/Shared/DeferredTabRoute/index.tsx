import React from "react";
import { useIsFocused } from "@react-navigation/native";

export function DeferredTabRoute({ children }: React.PropsWithChildren) {
  const isFocused = useIsFocused();
  const [hasBeenFocused, setHasBeenFocused] = React.useState(isFocused);

  React.useEffect(() => {
    if (!isFocused || hasBeenFocused) return;
    setHasBeenFocused(true);
  }, [hasBeenFocused, isFocused]);

  if (!hasBeenFocused && !isFocused) {
    return null;
  }

  return <>{children}</>;
}