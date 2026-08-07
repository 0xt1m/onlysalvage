'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Lightbulb, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Link } from '@/i18n/navigation'

interface Tip { heading: string; body: string }
interface Category { title: string; tips: Tip[] }

export function GuideTipSection({ categories }: { categories: Category[] }) {
  const t = useTranslations('Home')

  const allTips = categories.flatMap((category, ci) =>
    category.tips.map((tip, ti) => ({ ...tip, ci, ti }))
  )

  // Picked once on mount (not per-render) -- a fresh pick on every full page
  // load, same as any other client component's initial state, without
  // needing to fight Next's RSC caching for something this trivial.
  const [index] = useState(() => Math.floor(Math.random() * allTips.length))
  const tip = allTips[index]

  if (!tip) return null

  return (
    <Card className="flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="shrink-0 w-10 h-10 rounded-lg bg-primary-light/10 flex items-center justify-center">
        <Lightbulb className="w-5 h-5 text-primary-light" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-primary-light uppercase tracking-wide">{t('guideTip.label')}</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{tip.heading}</p>
        <p className="text-sm text-muted mt-0.5">{tip.body}</p>
      </div>
      <Link href={`/guide#guide-tip-${tip.ci}-${tip.ti}`} className="shrink-0">
        <Button variant="secondary" size="sm" className="flex items-center gap-2">
          {t('guideTip.viewGuide')}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </Link>
    </Card>
  )
}
