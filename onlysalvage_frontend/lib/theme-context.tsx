"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

function persistThemeCookie(theme: Theme) {
  // One year, readable by the server so the next request's HTML already has
  // the right data-theme attribute -- see app/[locale]/layout.tsx.
  document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
}

interface ThemeProviderProps {
  children: ReactNode
  // The theme the server already decided from the request cookie (or
  // undefined if there wasn't one yet). This has to seed the *state*, not
  // just the <html> attribute -- reading document/matchMedia in the initial
  // state would disagree with the server (which has no such thing) and
  // break hydration for anything that renders differently per theme, like
  // the navbar's Sun/Moon toggle.
  initialTheme?: Theme
}

export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(initialTheme ?? "light");

  useEffect(() => {
    // No cookie yet -- this is the first moment we can see the OS
    // preference. Doing it here (post-mount) rather than in the initial
    // state keeps the first paint identical to the server's.
    if (initialTheme === undefined && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    persistThemeCookie(theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
