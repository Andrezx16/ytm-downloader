import { request, API_BASE_URL } from "./client";

export interface AuthStatus {
  configured: boolean;
  imported_at: string | null;
}

export async function getAuthStatus(signal?: AbortSignal): Promise<AuthStatus> {
  return request<AuthStatus>("/auth/status", { signal });
}

export async function importCookies(file: File, signal?: AbortSignal): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/auth/cookies`, {
    method: "POST",
    body: formData,
    signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const message = data?.detail || "Failed to import cookies.";
    throw new Error(message);
  }
}

export async function removeCookies(signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/cookies`, {
    method: "DELETE",
    signal,
  });

  if (!response.ok && response.status !== 204) {
    throw new Error("Failed to remove cookies.");
  }
}
