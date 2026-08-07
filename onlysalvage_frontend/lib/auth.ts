import { getApiUrl } from "./apiUrl";

export async function login(username: string, password: string) {
  const res = await fetch(`${getApiUrl()}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  return res.json();
}

export async function googleLogin(credential: string) {
  const res = await fetch(`${getApiUrl()}/auth/login/google/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ credential }),
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, data: json as { detail: string; profile_complete?: boolean } | null };
}

export async function signUp(data: Record<string, unknown>) {
  const res = await fetch(`${getApiUrl()}/auth/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, data: json };
}

export async function logout() {
  const res = await fetch(`${getApiUrl()}/auth/logout/`, {
    method: "POST",
    credentials: "include",
  });
  return res.ok;
}

export async function refreshAccessToken(): Promise<boolean> {
  const res = await fetch(`${getApiUrl()}/auth/refresh/`, {
    method: "POST",
    credentials: "include",
  });
  return res.ok;
}

export async function requestPasswordReset(username: string) {
  const res = await fetch(`${getApiUrl()}/auth/password-reset/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, data: json };
}

export async function confirmPasswordReset(uid: string, token: string, newPassword: string) {
  const res = await fetch(`${getApiUrl()}/auth/password-reset/confirm/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, token, new_password: newPassword }),
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, data: json };
}