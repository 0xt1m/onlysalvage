'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Globe } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'
import { routing, localeNames } from '@/i18n/routing'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { updatePreferredLocale } from '@/lib/api'

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('Nav')
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const select = (code: string) => {
    router.replace(pathname, { locale: code })
    setOpen(false)
    // Only when logged in -- an anonymous switch already persists fine via
    // next-intl's own NEXT_LOCALE cookie, there's no account to attach it to.
    if (user) updatePreferredLocale(code)
  }

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative group" ref={containerRef}>
      <button
        type="button"
        aria-label={t('switchLanguage')}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center justify-center rounded-full p-3 transition [@media(hover:hover)]:hover:bg-surface-raised cursor-pointer',
          className
        )}
      >
        <Globe className="w-6 h-6 text-foreground" />
      </button>
      {!open && (
        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
          {t('switchLanguage')}
        </span>
      )}

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-30 mt-2 w-44 max-h-72 overflow-y-auto rounded-md border border-border bg-surface shadow-lg py-1"
        >
          {routing.locales.map((code) => (
            <li
              key={code}
              role="option"
              aria-selected={code === locale}
              onClick={() => select(code)}
              className={cn(
                'flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer text-foreground hover:bg-surface-raised',
                code === locale && 'bg-surface-raised'
              )}
            >
              <span>{localeNames[code]}</span>
              {code === locale && <Check className="w-4 h-4 text-primary-light shrink-0" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
