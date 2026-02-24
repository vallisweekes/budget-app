import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";

import { apiFetch } from "@/lib/api";
import {
  getStoredExpoPushToken,
  getStoredExpoPushTokenUsername,
  setStoredExpoPushToken,
  setStoredExpoPushTokenUsername,
} from "@/lib/storage";

function maskToken(token: string): string {
  const t = token.trim();
  if (t.length <= 16) return "***";
  return `${t.slice(0, 8)}…${t.slice(-6)}`;
}

function devLog(message: string, extra?: Record<string, unknown>) {
  if (!__DEV__) return;
  // eslint-disable-next-line no-console
  console.log(`[push] ${message}`, extra ?? "");
}

async function tryGetNotifications() {
  try {
    return await import("expo-notifications");
  } catch {
    devLog("expo-notifications not available (native module missing?)");
    return null;
  }
}

let _didConfigureHandler = false;
async function ensureNotificationHandlerConfigured() {
  if (_didConfigureHandler) return;
  const Notifications = await tryGetNotifications();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  _didConfigureHandler = true;
  devLog("notification handler configured");
}

function resolveExpoProjectId(): string | null {
  // Preferred (EAS builds)
  const easProjectId = (Constants.easConfig as { projectId?: unknown } | undefined)?.projectId;
  if (typeof easProjectId === "string" && easProjectId.trim()) return easProjectId.trim();

  // Legacy: app.json -> expo.extra.eas.projectId
  const extra = (Constants.expoConfig as { extra?: unknown } | undefined)?.extra;
  const legacyProjectId = (extra as any)?.eas?.projectId;
  if (typeof legacyProjectId === "string" && legacyProjectId.trim()) return legacyProjectId.trim();

  return null;
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== "android") return;

  const Notifications = await tryGetNotifications();
  if (!Notifications) return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function getExpoPushTokenAsync(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const Notifications = await tryGetNotifications();
  if (!Notifications) return null;

  await ensureNotificationHandlerConfigured();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    devLog("notification permission not granted", { status: finalStatus });
    return null;
  }

  await ensureAndroidNotificationChannel();

  const projectId = resolveExpoProjectId();
  try {
    const tokenResponse = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    devLog("expo push token acquired", { token: maskToken(tokenResponse.data), projectId: projectId ?? null });
    return tokenResponse.data;
  } catch {
    // If your Expo SDK requires projectId, this call will throw.
    devLog("failed to get expo push token (projectId may be required)", { projectId: projectId ?? null });
    return null;
  }
}

function resolveDeviceId(): string | null {
  const parts = [Device.modelId, (Device as any).osInternalBuildId, Device.osBuildId]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  return parts.length ? parts.join(":") : null;
}

export async function registerExpoPushToken(params: { username: string }): Promise<void> {
  const expoToken = await getExpoPushTokenAsync();
  if (!expoToken) {
    devLog("skipping registration (no expo token)");
    return;
  }

  const [storedToken, storedUsername] = await Promise.all([
    getStoredExpoPushToken(),
    getStoredExpoPushTokenUsername(),
  ]);

  if (storedToken === expoToken && storedUsername === params.username) {
    devLog("skipping registration (already registered)", { token: maskToken(expoToken), username: params.username });
    return;
  }

  const result = await apiFetch<{ ok?: boolean }>("/api/bff/push/mobile/register", {
    method: "POST",
    body: {
      token: expoToken,
      platform: Platform.OS,
      deviceId: resolveDeviceId(),
    },
  });

  devLog("registration request complete", { ok: Boolean(result?.ok), token: maskToken(expoToken), username: params.username });

  await Promise.all([
    setStoredExpoPushToken(expoToken),
    setStoredExpoPushTokenUsername(params.username),
  ]);
}
