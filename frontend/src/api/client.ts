import { ApiError } from "./errors";

const DEFAULT_TIMEOUT = 30_000;

export const API_BASE_URL: string = (() => {
  try {
    return import.meta.env.VITE_API_URL ?? "/api";
  } catch {
    return "/api";
  }
})();

export interface RequestOptions extends Omit<RequestInit, "signal"> {
  timeout?: number;
  signal?: AbortSignal;
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, signal: externalSignal, ...fetchOptions } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const combinedSignal = externalSignal
    ? combineSignals(externalSignal, controller.signal)
    : controller.signal;

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      signal: combinedSignal,
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const message = body?.detail ?? res.statusText;
      throw new ApiError(res.status, message, body);
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(0, "Request timed out");
    }
    throw new ApiError(0, err instanceof Error ? err.message : "Network error");
  } finally {
    clearTimeout(timer);
  }
}

function combineSignals(external: AbortSignal, internal: AbortSignal): AbortSignal {
  const controller = new AbortController();

  const onAbort = () => controller.abort();

  if (external.aborted || internal.aborted) {
    controller.abort();
    return controller.signal;
  }

  external.addEventListener("abort", onAbort, { once: true });
  internal.addEventListener("abort", onAbort, { once: true });

  return controller.signal;
}
