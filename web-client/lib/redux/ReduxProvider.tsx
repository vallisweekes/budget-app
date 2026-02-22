"use client";

import { Provider } from "react-redux";
import { setupListeners } from "@reduxjs/toolkit/query";
import { useEffect } from "react";
import { store } from "./store";

export default function ReduxProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const unsubscribe = setupListeners(store.dispatch);
    return unsubscribe;
  }, []);

  return <Provider store={store}>{children}</Provider>;
}
