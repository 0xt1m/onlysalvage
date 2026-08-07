"use client";
import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { login as apiLogin, logout as apiLogout, googleLogin as apiGoogleLogin } from "./auth";
import { getMe } from "./api"

type User = { username: string; preferred_locale?: string | null; [key: string]: any };

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  // Resolves to whether the account's profile (city/state/zip) is already
  // complete, so the caller knows whether to send a first-time Google
  // sign-up to fill that in before landing on the home page.
  loginWithGoogle: (credential: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  // Guards against redirecting more than once per mount -- the redirect
  // itself lands on a URL under the new locale, which remounts this whole
  // provider (the locale is a route segment), so this doesn't need to
  // survive beyond that; it just stops a second getMe() resolving mid-flight
  // (e.g. right after login()) from firing a second redirect.
  const syncedLocale = useRef(false);

  // Lets a logged-in user's remembered language (see LanguageSwitcher, which
  // is what actually sets this) follow them to a new device/browser or a
  // fresh session here, instead of only living in this browser's own
  // NEXT_LOCALE cookie. Only ever moves *toward* the account's preference,
  // and only once -- if they then manually switch languages this session,
  // that's a deliberate choice this shouldn't immediately override.
  const syncLocale = (u: User | null) => {
    if (syncedLocale.current) return;
    if (u?.preferred_locale && u.preferred_locale !== locale) {
      syncedLocale.current = true;
      router.replace(pathname, { locale: u.preferred_locale });
    }
  };

  useEffect(() => {
    getMe().then((u) => {
      setUser(u);
      setLoading(false);
      syncLocale(u);
    });
  }, []); // runs once, on initial app load

  const login = async (username: string, password: string) => {
    await apiLogin(username, password);
    const u = await getMe(); // fetch the fresh user right after login
    setUser(u);
    syncLocale(u);
  };

  const loginWithGoogle = async (credential: string) => {
    const { ok, data } = await apiGoogleLogin(credential);
    if (!ok) throw new Error(data?.detail || "Google login failed");
    const u = await getMe();
    setUser(u);
    syncLocale(u);
    return data?.profile_complete ?? true;
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
