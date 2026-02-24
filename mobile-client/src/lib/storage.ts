import * as SecureStore from "expo-secure-store";

import type { ThemeMode } from "@/lib/theme";

export const SESSION_KEY = "budget_app.session_token";
export const USERNAME_KEY = "budget_app.username";
export const THEME_MODE_KEY = "budget_app.theme_mode";
export const EXPO_PUSH_TOKEN_KEY = "budget_app.expo_push_token";
export const EXPO_PUSH_TOKEN_USERNAME_KEY = "budget_app.expo_push_token_username";

export async function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function setSessionToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(SESSION_KEY, token);
}

export async function clearSessionToken(): Promise<void> {
  return SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function getStoredUsername(): Promise<string | null> {
  return SecureStore.getItemAsync(USERNAME_KEY);
}

export async function setStoredUsername(username: string): Promise<void> {
  return SecureStore.setItemAsync(USERNAME_KEY, username);
}

export async function clearStoredUsername(): Promise<void> {
  return SecureStore.deleteItemAsync(USERNAME_KEY);
}

export async function getStoredThemeMode(): Promise<ThemeMode | null> {
  const v = await SecureStore.getItemAsync(THEME_MODE_KEY);
  if (v === "light" || v === "dark") return v;
  return null;
}

export async function setStoredThemeMode(mode: ThemeMode): Promise<void> {
  return SecureStore.setItemAsync(THEME_MODE_KEY, mode);
}

export async function getStoredExpoPushToken(): Promise<string | null> {
  return SecureStore.getItemAsync(EXPO_PUSH_TOKEN_KEY);
}

export async function setStoredExpoPushToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(EXPO_PUSH_TOKEN_KEY, token);
}

export async function clearStoredExpoPushToken(): Promise<void> {
  return SecureStore.deleteItemAsync(EXPO_PUSH_TOKEN_KEY);
}

export async function getStoredExpoPushTokenUsername(): Promise<string | null> {
  return SecureStore.getItemAsync(EXPO_PUSH_TOKEN_USERNAME_KEY);
}

export async function setStoredExpoPushTokenUsername(username: string): Promise<void> {
  return SecureStore.setItemAsync(EXPO_PUSH_TOKEN_USERNAME_KEY, username);
}

export async function clearStoredExpoPushTokenUsername(): Promise<void> {
  return SecureStore.deleteItemAsync(EXPO_PUSH_TOKEN_USERNAME_KEY);
}
