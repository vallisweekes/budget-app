import { configureStore } from "@reduxjs/toolkit";
import { bffApi } from "./api/bffApi";

export const store = configureStore({
  reducer: {
    [bffApi.reducerPath]: bffApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(bffApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
