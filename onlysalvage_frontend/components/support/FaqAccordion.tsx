'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, ArrowRight } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

interface FaqItem {
  question: string
  answer: string
}

interface FaqAccordionProps {
  items: FaqItem[]
  // Parallel to `items` -- the Guide page anchor (see guide/page.tsx's
  // "guide-tip-{categoryIndex}-{tipIndex}" ids) that answers the same
  // question in more depth, if one exists. undefined entries just render
  // without a link.
  guideLinks?: (string | undefined)[]
}

export function FaqAccordion({ items, guideLinks }: FaqAccordionProps) {
  const t = useTranslations('Support')
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="flex flex-col divide-y divide-border">
      {items.map((item, i) => {
        const isOpen = openIndex === i
        const guideAnchor = guideLinks?.[i]
        return (
          <div key={item.question} className="py-3">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 text-left cursor-pointer"
            >
              <span className="font-medium text-foreground">{item.question}</span>
              <ChevronDown className={cn('w-4 h-4 text-muted shrink-0 transition-transform', isOpen && 'rotate-180')} />
            </button>
            {isOpen && (
              <div className="flex flex-col items-start gap-1.5 mt-2">
                <p className="text-sm text-muted whitespace-pre-line">{item.answer}</p>
                {guideAnchor && (
                  <Link
                    href={`/guide#${guideAnchor}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary-light hover:underline"
                  >
                    {t('viewInGuide')}
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
