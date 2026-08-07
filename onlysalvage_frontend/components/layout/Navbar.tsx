'use client'

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Avatar } from "@/components/ui/Avatar";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useState, useEffect } from "react";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { User, Heart, GitCompare, LogOut, Home, Car, Headset, Tag, Sun, Moon, Settings } from "lucide-react"
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";

interface NavItem {
    key: "home" | "inventory" | "support" | "sell";
    href: string;
    icon: React.ElementType;
}

const navItems: NavItem[] = [
    { key: "home", href: "/", icon: Home },
    { key: "inventory", href: "/inventory", icon: Car },
    { key: "sell", href: "/sell", icon: Tag },
    { key: "support", href: "/support", icon: Headset },
]

export function Navbar({ className }: { className?: string }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const t = useTranslations("Nav");

  useEffect(() => {
    if (!menuOpen) return
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    router.push("/login");
    router.refresh();
  }

  const goTo = (href: string) => {
    setMenuOpen(false);
    router.push(href);
  }

  return (
    <nav className={cn(
      'sticky top-0 z-50 w-full bg-surface border-b border-border py-3 print:hidden',
      // On mobile, once the menu is open, the whole nav becomes a full-screen
      // flex column (header row + menu content below it) instead of a small
      // dropdown -- that way there's no separate fixed panel that has to guess
      // the header's pixel height to sit flush beneath it.
      menuOpen && 'max-md:fixed max-md:inset-0 max-md:flex max-md:flex-col max-md:overflow-y-auto',
      className
    )}>
      {/* max-w-1600 + px-6 together, matching every page's own content
          container -- putting the padding on the outer <nav> instead (as
          this used to) sits it *outside* the 1600px cap, so on wide screens
          the navbar's visible content ends up ~48px wider than the page
          content beneath it. */}
      <div className="max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 flex items-center justify-between w-full shrink-0">

        {/* The brand mark itself doesn't change with theme -- only the
            surrounding nav background does -- so this is the single logo
            file used everywhere in the app (auth panel, favicon, share
            images), not swapped per theme. */}
        <Link href="/" className="text-foreground font-bold text-xl">
          <Image src="/2.svg" alt={t("logo")} width={70} height={70} />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted hover:text-foreground transition-colors"
            >
              {t(item.key)}
            </Link>
          ))}
        </div>

        {/* Desktop buttons */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          <IconButton
            icon={theme === 'dark' ? Sun : Moon}
            label={theme === 'dark' ? t("switchToLight") : t("switchToDark")}
            onClick={toggleTheme}
          />
          <IconButton
            icon={Heart}
            label={t("likedCars")}
            onClick={() => router.push(user ? `/profile/${user.username}/#watchlist` : '/liked')}
            data-watchlist-nav-icon
          />
          <IconButton
            icon={GitCompare}
            label={t("compare")}
            onClick={() => router.push('/compare')}
            data-compare-nav-icon
          />
          <div className="flex border border-border items-center p-2 rounded-lg gap-1">
            {loading ? (
              <div className="h-9 w-9 rounded-md bg-muted/30 animate-pulse" />
            ) : user ? (
              <>
                <Link
                  href={`/profile/${user.username}/`}
                  className="relative group p-1 rounded-full [@media(hover:hover)]:hover:bg-surface-raised transition"
                >
                  <Avatar name={user.username} src={user.profile_picture} size="sm" />
                  {/* Username only shows up as a hover tooltip -- the avatar
                      speaks for itself day-to-day, no need for the name to
                      take up permanent space in the bar. */}
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                    {user.username}
                  </span>
                </Link>
                <IconButton icon={Settings} label={t("settings")} onClick={() => router.push('/settings')} />
                <IconButton icon={LogOut} label={t("logOut")} onClick={handleLogout} />
              </>
            ) : (
              <IconButton
                icon={User}
                label={t("myProfile")}
                onClick={() => router.push('/login')}
              />
            )}
          </div>
        </div>

        {/* Mobile header buttons */}
        <div className="md:hidden flex items-center gap-1">
          <LanguageSwitcher className="p-2" />
          <IconButton
            icon={theme === 'dark' ? Sun : Moon}
            label={theme === 'dark' ? t("switchToLight") : t("switchToDark")}
            onClick={toggleTheme}
            className="p-2"
          />
          <button
            className="relative group text-foreground cursor-pointer p-1"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
            aria-expanded={menuOpen}
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen
                ? <path d="M6 18L18 6M6 6l12 12" />
                : <path d="M3 12h18M3 6h18M3 18h18" />
              }
            </svg>
            <span className="pointer-events-none absolute right-0 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
              {menuOpen ? t("closeMenu") : t("openMenu")}
            </span>
          </button>
        </div>

      </div>

      {/* Mobile menu content -- fills the rest of the full-screen nav below
          the header row above, once open. */}
      {menuOpen && (
        <div className="md:hidden flex flex-col flex-1 min-h-0">
          <div className="flex flex-col px-4 pt-2 gap-1 overflow-y-auto">
            {navItems.map(item => {
              const Icon = item.icon
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 font-medium py-3 px-2 rounded-lg transition-colors',
                    active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-surface-raised'
                  )}
                  onClick={() => setMenuOpen(false)}
                >
                  <span className={cn(
                    'flex items-center justify-center w-9 h-9 rounded-lg shrink-0',
                    active ? 'bg-primary/15' : 'bg-surface-raised'
                  )}>
                    <Icon className={cn('w-4 h-4', active ? 'text-primary' : 'text-muted')} />
                  </span>
                  {t(item.key)}
                </Link>
              )
            })}
            <button
              onClick={() => goTo(user ? `/profile/${user.username}/#watchlist` : '/liked')}
              className="flex items-center gap-3 text-foreground font-medium py-3 px-2 rounded-lg hover:bg-surface-raised transition-colors cursor-pointer text-left"
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 bg-surface-raised">
                <Heart className="w-4 h-4 text-muted" />
              </span>
              {t("likedCars")}
            </button>
            <button
              onClick={() => goTo('/compare')}
              className="flex items-center gap-3 text-foreground font-medium py-3 px-2 rounded-lg hover:bg-surface-raised transition-colors cursor-pointer text-left"
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0 bg-surface-raised">
                <GitCompare className="w-4 h-4 text-muted" />
              </span>
              {t("compare")}
            </button>
          </div>

          <div className="mt-auto px-4 pb-6 pt-3 border-t border-border">
            {loading ? (
              <div className="h-11 w-full rounded-md bg-muted/30 animate-pulse" />
            ) : user ? (
              <div className="rounded-xl bg-surface-raised p-3 flex flex-col gap-1">
                <button
                  onClick={() => goTo(`/profile/${user.username}/`)}
                  className="flex items-center gap-3 py-1.5 px-1 rounded-md hover:bg-surface transition-colors cursor-pointer text-left"
                >
                  <Avatar name={user.username} src={user.profile_picture} size="sm" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-foreground font-medium truncate">{user.username}</span>
                    <span className="text-xs text-muted">{t("viewProfile")}</span>
                  </div>
                </button>
                <button
                  onClick={() => goTo('/settings')}
                  className="flex items-center gap-2 text-foreground text-sm py-2 px-1 rounded-md hover:bg-surface transition-colors cursor-pointer text-left"
                >
                  <Settings className="w-4 h-4 text-muted" />
                  {t("settings")}
                </button>
                <div className="border-t border-border my-1" />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-error text-sm py-2 px-1 rounded-md hover:bg-surface transition-colors cursor-pointer text-left"
                >
                  <LogOut className="w-4 h-4" />
                  {t("logOut")}
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button variant="secondary" size="md" className="flex-1" onClick={() => goTo("/login")}>{t("logIn")}</Button>
                <Button size="md" className="flex-1" onClick={() => goTo("/sign-up")}>{t("signUp")}</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
