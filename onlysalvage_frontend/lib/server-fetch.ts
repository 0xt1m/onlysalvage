import { cookies } from "next/headers";
import { getApiUrl } from "./apiUrl";

export async function serverFetch(path: string, options: RequestInit = {}) {
  const cookieStore = await cookies();
  const cookieHeader = ["access", "refresh_token"]
    .map((name) => cookieStore.get(name))
    .filter(Boolean)
    .map((c) => `${c!.name}=${c!.value}`)
    .join("; ");

  return fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: { Cookie: cookieHeader, ...options.headers },
    cache: "no-store",
  })
}