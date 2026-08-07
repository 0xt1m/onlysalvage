'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Select } from '@/components/ui/Select'
import { ListingResultsGrid } from '@/components/listings/ListingResultsGrid'
import type { ListingSummary } from '@/lib/types'

interface ProfileListingsSectionProps {
  listings: ListingSummary[]
  emptyMessage: string
  currentUsername?: string
}

// Same value/label shape as InventoryBrowser's SORT_OPTIONS, minus `distance`
// (no location context on a profile page) -- sorted client-side rather than
// via a re-fetch, since every one of a seller's listings is already loaded
// on this page in one shot.
const SORT_OPTIONS: { value: string; key: string; sort: (a: ListingSummary, b: ListingSummary) => number }[] = [
  { value: '-created_at', key: 'newest', sort: (a, b) => +new Date(b.created_at) - +new Date(a.created_at) },
  { value: 'price', key: 'priceAsc', sort: (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) },
  { value: '-price', key: 'priceDesc', sort: (a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity) },
  { value: 'mileage', key: 'mileageAsc', sort: (a, b) => (a.mileage ?? Infinity) - (b.mileage ?? Infinity) },
  { value: '-year', key: 'yearDesc', sort: (a, b) => b.year - a.year },
]
const DEFAULT_SORT = SORT_OPTIONS[0].value

export function ProfileListingsSection({ listings, emptyMessage, currentUsername }: ProfileListingsSectionProps) {
  const t = useTranslations('Inventory')
  const [sort, setSort] = useState(DEFAULT_SORT)

  const sorted = useMemo(() => {
    const option = SORT_OPTIONS.find((o) => o.value === sort)
    return option ? listings.slice().sort(option.sort) : listings
  }, [listings, sort])

  if (listings.length === 0) {
    return <ListingResultsGrid listings={listings} variant="v" columns={4} emptyMessage={emptyMessage} currentUsername={currentUsername} />
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          options={SORT_OPTIONS.map((o) => ({ value: o.value, label: t(`sortOptions.${o.key}`) }))}
          className="text-sm w-full sm:w-56"
        />
      </div>
      <ListingResultsGrid listings={sorted} variant="v" columns={4} emptyMessage={emptyMessage} currentUsername={currentUsername} />
    </div>
  )
}
