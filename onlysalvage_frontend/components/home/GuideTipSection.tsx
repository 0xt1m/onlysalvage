'use client'

import { useEffect, useState } from 'react'
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

  // Starts at a fixed index so the server-rendered HTML and the client's
  // first render match exactly -- picking randomly inside the initial
  // useState (as this used to) meant the server and the client each rolled
  // their own independent random index, guaranteeing a hydration mismatch
  // (React error #418, "text content does not match server-rendered HTML")
  // on every single page load. The actual random pick happens in this
  // effect instead, which only runs client-side after hydration has already
  // completed -- a plain post-mount UI update, not part of the hydration
  // pass, so there's nothing for the server and client to disagree about.
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(Math.floor(Math.random() * allTips.length))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
