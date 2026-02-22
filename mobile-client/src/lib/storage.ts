import * as SecureStore from "expo-secure-store";

export const SESSION_KEY = "budget_app.session_token";
export const USERNAME_KEY = "budget_app.username";

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
