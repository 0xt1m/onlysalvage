'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { ListingResultsGrid } from '@/components/listings/ListingResultsGrid'
import { useAuth } from '@/lib/auth-context'
import { getListings } from '@/lib/api'
import type { ListingSummary } from '@/lib/types'

type State = 'idle' | 'loading' | 'error' | 'empty' | 'done'

export function NearYouSection() {
  const t = useTranslations('NearYouSection')
  const { user } = useAuth()
  const [state, setState] = useState<State>('idle')
  const [listings, setListings] = useState<ListingSummary[]>([])
  const [error, setError] = useState('')

  const handleFindNearby = () => {
    if (!navigator.geolocation) {
      setError(t('geolocationNotSupported'))
      setState('error')
      return
    }

    setState('loading')
    setError('')

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { results } = await getListings({
          lat: String(pos.coords.latitude),
          lng: String(pos.coords.longitude),
          max_distance: '50',
          exclude_sold: 'true',
          ordering: 'distance',
        })
        const nearby = results.slice(0, 4)
        setListings(nearby)
        setState(nearby.length > 0 ? 'done' : 'empty')
      },
      () => {
        setError(t('geolocationFailed'))
        setState('error')
      },
      { timeout: 10000 }
    )
  }

  if (state === 'done') {
    return (
      <Card>
        <SectionHeader title={t('title')} subtitle={t('subtitle')} viewAllHref="/inventory?nearby=true" />
        <ListingResultsGrid listings={listings} variant="v" columns={4} currentUsername={user?.username} />
      </Card>
    )
  }

  return (
    <Card className="items-center text-center gap-3 py-10">
      <MapPin className="w-8 h-8 text-primary" />
      <h3 className="text-xl font-semibold">{t('findCarsNearYou')}</h3>
      <p className="text-muted text-sm max-w-md">
        {state === 'empty'
          ? t('emptyNearby')
          : t('promptText')}
      </p>
      {error && <p className="text-error text-sm max-w-md">{error}</p>}
      {state === 'loading' ? (
        <Spinner />
      ) : (
        <Button onClick={handleFindNearby}>{t('showNearbyListings')}</Button>
      )}
    </Card>
  )
}
