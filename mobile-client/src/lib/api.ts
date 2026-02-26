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
  /** Optional override for GET cache TTL in ms; set 0 to disable for this call */
  cacheTtlMs?: number;
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

function isGetMethod(method?: ApiFetchOptions["method"]): boolean {
  return (method ?? "GET") === "GET";
}

function getDefaultCacheTtlMs(path: string): number {
  const normalized = path.toLowerCase();
  if (normalized.startsWith("/api/bff/settings")) return 6_000;
  if (normalized.startsWith("/api/bff/budget-plans")) return 6_000;
  if (normalized.startsWith("/api/bff/categories")) return 4_000;
  if (normalized.startsWith("/api/bff/expenses/summary")) return 3_000;
  if (normalized.startsWith("/api/bff/expenses?")) return 3_000;
  if (normalized.startsWith("/api/bff/debt-summary")) return 4_000;
  if (normalized.startsWith("/api/bff/dashboard")) return 3_000;
  if (normalized.startsWith("/api/bff/income-summary")) return 4_000;
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
  const cookieHeader = sessionToken
    ? `next-auth.session-token=${sessionToken}`
    : undefined;

  const response = await fetch(url, {
    method,
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
