"use client";

import { SESSION_STORAGE_KEY } from "@/lib/auth-constants";

export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(SESSION_STORAGE_KEY);
}

export function setSessionToken(token: string) {
  sessionStorage.setItem(SESSION_STORAGE_KEY, token);
}

export function clearSessionToken() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export async function apiFetch(input: string, init: RequestInit = {}) {
  const token = getSessionToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (
    init.body &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    clearSessionToken();
  }
  return response;
}
