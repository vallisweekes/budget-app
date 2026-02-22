"use client";

import ReduxProvider from "@/lib/redux/ReduxProvider";
import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/Shared";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
			<ToastProvider>
				<ReduxProvider>{children}</ReduxProvider>
			</ToastProvider>
    </SessionProvider>
  );
}

