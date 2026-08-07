'use client'

import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getListings } from '@/lib/api'

const STORAGE_KEY = 'inventory-nav-context'

interface NavContext {
  slugs: string[]
  count: number
  page: number
  pageSize: number
  params: Record<string, string>
}

function readContext(): NavContext | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.slugs)) return null
    return parsed as NavContext
  } catch {
    return null
  }
}

interface ListingNavArrowsProps {
  slug: string
}

// Set only by InventoryBrowser as the user searches/browses -- these arrows
// only appear when the current listing shows up in that stored search
// context, so a listing opened any other way (a direct link, a share, a
// home page section) correctly shows nothing to page through.
export function ListingNavArrows({ slug }: ListingNavArrowsProps) {
  const t = useTranslations('ListingDetail')
  const router = useRouter()
  const [ctx, setCtx] = useState<NavContext | null | undefined>(undefined)
  const [fetchingNext, setFetchingNext] = useState(false)

  useEffect(() => {
    setCtx(readContext())
  }, [slug])

  if (!ctx) return null

  const index = ctx.slugs.indexOf(slug)
  if (index === -1) return null

  const prevSlug = index > 0 ? ctx.slugs[index - 1] : null
  const hasNextLoaded = index < ctx.slugs.length - 1
  const nextSlug = hasNextLoaded ? ctx.slugs[index + 1] : null
  const canFetchMore = !hasNextLoaded && ctx.slugs.length < ctx.count

  if (!prevSlug && !nextSlug && !canFetchMore) return null

  const handleNext = async () => {
    if (nextSlug) {
      router.push(`/inventory/${nextSlug}`)
      return
    }
    if (!canFetchMore) return

    setFetchingNext(true)
    const nextPage = ctx.page + 1
    const { results } = await getListings({ ...ctx.params, page: String(nextPage), page_size: String(ctx.pageSize) })
    setFetchingNext(false)

    const newSlugs = results.map((r) => r.slug).filter((s) => !ctx.slugs.includes(s))
    if (newSlugs.length === 0) return

    const updated: NavContext = { ...ctx, slugs: [...ctx.slugs, ...newSlugs], page: nextPage }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch {
      // ignore -- worst case just means this fetch-ahead isn't remembered
    }
    router.push(`/inventory/${newSlugs[0]}`)
  }

  return (
    <div className="flex items-center justify-between gap-3 print:hidden">
      <Button
        type="button"
        variant="secondary"
        onClick={() => prevSlug && router.push(`/inventory/${prevSlug}`)}
        disabled={!prevSlug}
        className="flex items-center gap-2"
      >
        <ChevronLeft className="w-4 h-4" />
        {t('previousListing')}
      </Button>
      <span className="text-xs text-muted shrink-0">
        {t('listingPosition', { current: index + 1, total: ctx.count })}
      </span>
      <Button
        type="button"
        variant="secondary"
        onClick={handleNext}
        disabled={fetchingNext || (!nextSlug && !canFetchMore)}
        className="flex items-center gap-2"
      >
        {fetchingNext ? <Loader2 className="w-4 h-4 animate-spin" /> : t('nextListing')}
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  )
}
