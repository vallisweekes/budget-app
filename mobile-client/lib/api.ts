import Constants from "expo-constants";
import * as Device from "expo-device";

import { getSessionToken } from "@/lib/storage";

type ApiBaseUrlInfo = {
  configuredUrl: string;
  resolvedUrl: string;
  wasAutoResolved: boolean;
};

const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function getConfiguredApiBaseUrl(): string {
  const baseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("Missing EXPO_PUBLIC_API_BASE_URL in .env");
  }
  return baseUrl;
}

function extractHost(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    return new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`).hostname.trim();
  } catch {
    return trimmed.replace(/^https?:\/\//, "").split(":")[0]?.trim() ?? "";
  }
}

function resolveExpoDevHost(): string {
  const candidates = [
    Constants.expoGoConfig?.debuggerHost,
    Constants.expoConfig?.hostUri,
    Constants.platform?.hostUri,
    Constants.linkingUri,
  ];

  for (const candidate of candidates) {
    const host = typeof candidate === "string" ? extractHost(candidate) : "";
    if (host && !LOCALHOST_HOSTS.has(host)) {
      return host;
    }
  }

  return "";
}

export function getApiBaseUrlInfo(): ApiBaseUrlInfo {
  const configuredUrl = getConfiguredApiBaseUrl();

  let parsed: URL;
  try {
    parsed = new URL(configuredUrl);
  } catch {
    throw new Error("EXPO_PUBLIC_API_BASE_URL must be a full URL like http://localhost:5537");
  }

  if (!Device.isDevice || !LOCALHOST_HOSTS.has(parsed.hostname)) {
    return {
      configuredUrl,
      resolvedUrl: parsed.toString().replace(/\/$/, ""),
      wasAutoResolved: false,
    };
  }

  const expoDevHost = resolveExpoDevHost();
  if (!expoDevHost) {
    throw new Error(
      "EXPO_PUBLIC_API_BASE_URL points to localhost, which does not work on a physical device. Set it to http://<YOUR_MAC_IP>:5537."
    );
  }

  parsed.hostname = expoDevHost;

  return {
    configuredUrl,
    resolvedUrl: parsed.toString().replace(/\/$/, ""),
    wasAutoResolved: true,
  };
}

export function getApiBaseUrl(): string {
  return getApiBaseUrlInfo().resolvedUrl;
}

// Global callback invoked when the server returns 401.
// AuthProvider registers itself here so apiFetch can trigger sign-out.
let _onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(cb: (() => void) | null) {
  _onUnauthorized = cb;
}

// When true, 401 responses do NOT trigger the global sign-out callback.
// Used during app init / onboarding checks to avoid premature sign-out.
let _suppressUnauthorized = false;
export function suppressUnauthorizedCallback(value: boolean) {
  _suppressUnauthorized = value;
}

export type ApiFetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  /** Pass false to skip injecting the session cookie (e.g. during sign-in flow) */
  withAuth?: boolean;
  /** Optional override for GET cache TTL in ms; set 0 to disable for this call */
  cacheTtlMs?: number;
  /** If true, a 401 response will NOT trigger the global _onUnauthorized sign-out callback */
  skipOnUnauthorized?: boolean;
  /** Request timeout in milliseconds (default 25000) */
  timeoutMs?: number;
};

export class ApiError extends Error {
  status: number;
  code: string | null;
  detail: string | null;

  constructor(message: string, params: { status: number; code?: string | null; detail?: string | null }) {
    super(message);
    this.name = "ApiError";
    this.status = params.status;
    this.code = params.code ?? null;
    this.detail = params.detail ?? null;
  }
}

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const inflightRequests = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, CacheEntry>();
let apiMutationVersion = 0;

function isGetMethod(method?: ApiFetchOptions["method"]): boolean {
  return (method ?? "GET") === "GET";
}

function getDefaultCacheTtlMs(path: string): number {
  const normalized = path.toLowerCase();
  if (normalized.startsWith("/api/bff/settings")) return 6_000;
  if (normalized.startsWith("/api/bff/budget-plans")) return 6_000;
  if (normalized.startsWith("/api/bff/categories")) return 4_000;
  if (normalized.startsWith("/api/bff/expenses/summary")) return 0;
  if (normalized.startsWith("/api/bff/expenses?")) return 0;
  if (normalized.startsWith("/api/bff/debt-summary")) return 0;
  if (normalized.startsWith("/api/bff/dashboard")) return 0;
  if (normalized.startsWith("/api/bff/income-summary")) return 0;
  return 0;
}

function buildRequestKey(path: string, options: ApiFetchOptions, authIdentity: string): string {
  const method = options.method ?? "GET";
  const body = options.body === undefined ? "" : JSON.stringify(options.body);
  return `${method}|${path}|auth:${authIdentity}|${body}`;
}

export function invalidateApiCache() {
  responseCache.clear();
  inflightRequests.clear();
}

export function getApiMutationVersion(): number {
  return apiMutationVersion;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${getApiBaseUrl()}${normalizedPath}`;

  const withAuth = options.withAuth !== false;
  const sessionToken = withAuth ? await getSessionToken() : null;
  const authIdentity = withAuth ? (sessionToken ?? "none") : "public";
  const method = options.method ?? "GET";
  const isGet = isGetMethod(method);
  const cacheTtlMs = isGet ? (options.cacheTtlMs ?? getDefaultCacheTtlMs(normalizedPath)) : 0;

  const requestKey = buildRequestKey(normalizedPath, options, authIdentity);
  if (isGet && cacheTtlMs > 0) {
    const existing = responseCache.get(requestKey);
    if (existing && existing.expiresAt > Date.now()) {
      return existing.value as T;
    }
    if (existing && existing.expiresAt <= Date.now()) {
      responseCache.delete(requestKey);
    }
  }

  const inflight = inflightRequests.get(requestKey);
  if (inflight) {
    return (await inflight) as T;
  }

  const execute = async (): Promise<T> => {
    const authHeaders: Record<string, string> = sessionToken
      ? {
          Authorization: `Bearer ${sessionToken}`,
          // Some platforms block manually setting Cookie headers; keep as best-effort fallback.
          Cookie: `next-auth.session-token=${sessionToken}`,
        }
      : {};

    const controller = new AbortController();
    const timeoutMs = Math.max(1, options.timeoutMs ?? 25_000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
          ...(options.headers ?? {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError("Request timed out. Please try again.", {
          status: 408,
          code: "REQUEST_TIMEOUT",
          detail: `${method} ${normalizedPath} timed out after ${timeoutMs}ms`,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const responseText = await response.text();
    const parsed = responseText ? safeParseJson(responseText) : null;

    if (!response.ok) {
      // Auto-sign-out on 401 so the user is returned to the login screen.
      // Skip if the caller opted out or if globally suppressed (e.g. during init).
      if (response.status === 401 && _onUnauthorized && !options.skipOnUnauthorized && !_suppressUnauthorized) {
        _onUnauthorized();
      }

    const parsedObj =
      parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    const serverMessage =
      typeof parsedObj?.["error"] === "string" ? parsedObj["error"] : null;

    const serverCode =
      typeof parsedObj?.["code"] === "string" ? (parsedObj["code"] as string) : null;

    const serverDetail =
      typeof parsedObj?.["detail"] === "string" ? (parsedObj["detail"] as string) : null;

    const baseMessage = serverMessage ?? response.statusText ?? `HTTP ${response.status}`;
    const message =
      __DEV__ && serverMessage && serverDetail && serverDetail.trim() && serverDetail !== serverMessage
        ? `${serverMessage}: ${serverDetail}`
        : baseMessage;

      throw new ApiError(message, {
        status: response.status,
        code: serverCode,
        detail: serverDetail,
      });
    }

    const result = ((parsed as T) ?? ({} as T));
    if (isGet && cacheTtlMs > 0) {
      responseCache.set(requestKey, {
        value: result,
        expiresAt: Date.now() + cacheTtlMs,
      });
    } else if (!isGet) {
      // Any successful mutation can invalidate stale aggregates/list responses.
      invalidateApiCache();
      apiMutationVersion += 1;
    }

    return result;
  };

  const promise = execute().finally(() => {
    inflightRequests.delete(requestKey);
  });

  inflightRequests.set(requestKey, promise as Promise<unknown>);
  return promise;
}

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
