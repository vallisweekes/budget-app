import ReduxProvider from "@/lib/redux/ReduxProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ReduxProvider>{children}</ReduxProvider>;
}
