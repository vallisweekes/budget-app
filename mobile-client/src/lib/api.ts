import { getSessionToken } from "@/lib/storage";

export function getApiBaseUrl(): string {
  const baseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("Missing EXPO_PUBLIC_API_BASE_URL in .env");
  }
  return baseUrl;
}

// Global callback invoked when the server returns 401.
// AuthProvider registers itself here so apiFetch can trigger sign-out.
let _onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(cb: (() => void) | null) {
  _onUnauthorized = cb;
}

export type ApiFetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  /** Pass false to skip injecting the session cookie (e.g. during sign-in flow) */
  withAuth?: boolean;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${getApiBaseUrl()}${normalizedPath}`;

  const withAuth = options.withAuth !== false;
  const sessionToken = withAuth ? await getSessionToken() : null;
  const cookieHeader = sessionToken
    ? `next-auth.session-token=${sessionToken}`
    : undefined;

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const responseText = await response.text();
  const parsed = responseText ? safeParseJson(responseText) : null;

  if (!response.ok) {
    // Auto-sign-out on 401 so the user is returned to the login screen
    if (response.status === 401 && _onUnauthorized) {
      _onUnauthorized();
    }

    const parsedObj =
      parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    const serverMessage =
      typeof parsedObj?.["error"] === "string" ? parsedObj["error"] : null;
    throw new Error(serverMessage ?? response.statusText ?? `HTTP ${response.status}`);
  }

  return (parsed as T) ?? ({} as T);
}

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
