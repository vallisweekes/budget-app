import type { NextConfig } from "next";
import withPWAInit, { runtimeCaching } from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      // Keep DB-backed API responses always fresh.
      {
        urlPattern: /^\/api\//,
        handler: "NetworkOnly",
        method: "GET",
      },
      ...runtimeCaching,
    ],
  },
});

const nextConfig: NextConfig = {
  /* config options here */
  // Acknowledge Turbopack usage with PWA webpack config
  turbopack: {},
};

export default withPWA(nextConfig);
