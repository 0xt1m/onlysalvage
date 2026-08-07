'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Spinner } from '@/components/ui/Spinner'
import { ListingResultsGrid } from '@/components/listings/ListingResultsGrid'
import { getListings } from '@/lib/api'
import { getLocalWatchlist } from '@/lib/localWatchlist'
import type { ListingSummary } from '@/lib/types'

// Anonymous visitors: their watchlist lives in this browser's localStorage,
// so it has to be resolved client-side rather than server-rendered.
export function LocalWatchlist() {
  const t = useTranslations('LocalWatchlist')
  const [listings, setListings] = useState<ListingSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ids = getLocalWatchlist()
    if (ids.length === 0) {
      setLoading(false)
      return
    }
    // Sold listings stay on the watchlist -- same reasoning as the
    // logged-in watchlist views; is_active=true is still the default in
    // getListings, so a paused (not sold) one is still excluded.
    getListings({ ids: ids.join(',') }).then(({ results }) => {
      setListings(results)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  return (
    <ListingResultsGrid
      listings={listings}
      variant="v"
      emptyMessage={t('emptyMessage')}
      removeOnUnlike
    />
  )
}
