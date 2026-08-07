'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Languages, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { translateText } from '@/lib/api'
import { routing, localeNames } from '@/i18n/routing'

interface TranslatableTextProps {
  text: string
  className?: string
}

export function TranslatableText({ text, className }: TranslatableTextProps) {
  const t = useTranslations('TranslatableText')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [translated, setTranslated] = useState<{ lang: string; text: string } | null>(null)
  // Avoids re-billing the API if the visitor toggles back to a language
  // they already translated into during this view.
  const cacheRef = useRef<Record<string, string>>({})
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleSelect = async (lang: string) => {
    setOpen(false)

    if (cacheRef.current[lang]) {
      setTranslated({ lang, text: cacheRef.current[lang] })
      return
    }

    setLoading(true)
    const result = await translateText(text, lang)
    setLoading(false)

    if (!result?.translated_text) {
      toast.error(t('translationFailed'))
      return
    }

    cacheRef.current[lang] = result.translated_text
    setTranslated({ lang, text: result.translated_text })
  }

  return (
    <div>
      <p className={className}>{translated ? translated.text : text}</p>

      <div className="relative mt-2 inline-block print:hidden">
        {translated ? (
          <button
            type="button"
            onClick={() => setTranslated(null)}
            className="text-sm text-primary hover:underline flex items-center gap-1.5"
          >
            <Languages className="w-3.5 h-3.5" />
            {t('viewOriginal')}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            disabled={loading}
            className="text-sm text-primary hover:underline flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
            {t('translate')}
          </button>
        )}

        {open && (
          <div
            ref={menuRef}
            className="absolute z-10 mt-1 bg-surface border border-border rounded-md shadow-md py-1 min-w-[140px]"
          >
            {routing.locales.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => handleSelect(loc)}
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-raised"
              >
                {localeNames[loc]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
