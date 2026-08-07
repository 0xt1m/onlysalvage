'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  FileText, Search, Wrench, FileCheck, ShieldCheck, Landmark,
  MessageCircleQuestion, ListChecks, RotateCcw, Printer, Info,
  FileSearch, ScanLine, Droplets, Scale,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { BuyerChecklistCategory } from '@/lib/types'
import { getCheckedItemIds, setItemChecked, clearChecklistProgress } from '@/lib/buyerChecklist'

// The admin's `icon` field (see checklist/models.py) is a free-text Lucide
// icon name, not validated against this list -- an unrecognized name just
// falls back to ListChecks below rather than breaking the page.
const ICONS: Record<string, React.ElementType> = {
  FileText, Search, Wrench, FileCheck, ShieldCheck, Landmark, MessageCircleQuestion, ListChecks,
  FileSearch, ScanLine, Droplets, Scale,
}

interface BuyerChecklistContentProps {
  categories: BuyerChecklistCategory[]
}

export function BuyerChecklistContent({ categories }: BuyerChecklistContentProps) {
  const t = useTranslations('Checklist')
  // Starts empty on the server-rendered pass (localStorage doesn't exist
  // there) and fills in right after mount -- same reasoning as
  // localWatchlist's consumers elsewhere on the site.
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setCheckedIds(new Set(getCheckedItemIds()))
    setMounted(true)
  }, [])

  const totalItems = categories.reduce((sum, cat) => sum + cat.items.length, 0)
  const checkedCount = mounted
    ? categories.reduce(
        (sum, cat) => sum + cat.items.filter((item) => checkedIds.has(item.id)).length,
        0,
      )
    : 0
  const percent = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0

  function toggle(itemId: number) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      const nowChecked = !next.has(itemId)
      if (nowChecked) next.add(itemId)
      else next.delete(itemId)
      setItemChecked(itemId, nowChecked)
      return next
    })
  }

  function reset() {
    clearChecklistProgress()
    setCheckedIds(new Set())
  }

  return (
    <div className="flex flex-col gap-3 print:gap-1">
      <Card className="print:hidden">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <ListChecks className="w-4 h-4 text-primary-light shrink-0" />
            <span className="text-sm font-medium">
              {t('progress', { checked: checkedCount, total: totalItems })}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {checkedCount > 0 && (
              <Button variant="ghost" size="sm" onClick={reset} className="flex items-center gap-1.5 text-muted">
                <RotateCcw className="w-3.5 h-3.5" />
                {t('reset')}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => window.print()} className="flex items-center gap-1.5 text-muted">
              <Printer className="w-3.5 h-3.5" />
              {t('print')}
            </Button>
          </div>
        </div>
        <div className="w-full h-2 rounded-full bg-surface-raised overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </Card>

      {categories.map((category) => {
        const Icon = ICONS[category.icon] ?? ListChecks
        return (
          <Card
            key={category.id}
            className="print:p-2 print:gap-2 print:break-inside-avoid print:mb-2"
          >
            <div className="flex items-center gap-2.5 print:gap-2">
              <div className="w-8 h-8 print:w-6 print:h-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 print:w-3.5 print:h-3.5 text-primary-light" />
              </div>
              <h3 className="text-lg print:text-base print:font-bold font-semibold">{category.title}</h3>
            </div>

            <div className="flex flex-col">
              {category.items.map((item, index) => {
                const ItemIcon = ICONS[item.icon]
                const checked = checkedIds.has(item.id)
                const isLast = index === category.items.length - 1
                return (
                  <label
                    key={item.id}
                    className={cn(
                      'flex items-center gap-3 print:gap-2.5 cursor-pointer select-none rounded-lg py-3 print:py-2.5 px-2 print:px-0 transition-colors [@media(hover:hover)]:hover:bg-surface-raised',
                      !isLast && 'border-b border-border print:border-border/70',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(item.id)}
                      className="hidden"
                    />
                    <div className={cn(
                      'w-5 h-5 print:w-4 print:h-4 shrink-0 rounded-md border-2 border-border flex items-center justify-center transition-colors duration-75',
                      checked ? 'bg-primary border-primary' : 'bg-surface',
                    )}>
                      {checked && (
                        <svg className="w-3.5 h-3.5 print:w-3 print:h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    {ItemIcon && (
                      <div className="w-9 h-9 print:w-7 print:h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <ItemIcon className="w-4.5 h-4.5 print:w-3.5 print:h-3.5 text-primary-light" />
                      </div>
                    )}
                    <span className="flex flex-col min-w-0">
                      <span className={cn(
                        'text-base print:text-sm break-words',
                        checked ? 'text-muted line-through' : 'text-foreground',
                      )}>
                        {item.text}
                      </span>
                      {item.note && (
                        <span className="flex items-start gap-1.5 text-sm print:text-xs text-muted mt-1.5 print:mt-1">
                          <Info className="w-3.5 h-3.5 print:w-3 print:h-3 shrink-0 mt-0.5" />
                          {item.note}
                        </span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
