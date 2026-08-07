'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export function BackToTopButton() {
  const t = useTranslations('BackToTopButton')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label={t('backToTop')}
      style={{ bottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 1rem))' }}
      className={cn(
        'group fixed right-6 z-40 p-3 rounded-full bg-primary-light text-white shadow-lg cursor-pointer print:hidden',
        'transition-all duration-200 hover:bg-primary-hover',
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
      )}
    >
      <ArrowUp className="w-5 h-5" />
      <span className="pointer-events-none absolute right-0 bottom-full mb-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {t('backToTop')}
      </span>
    </button>
  )
}
