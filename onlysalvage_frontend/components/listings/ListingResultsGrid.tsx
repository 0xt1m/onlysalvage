'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ListingCard } from '@/components/ui/ListingCard'
import { safeImageUrl, labelFor, sellerDisplayName } from '@/lib/utils'
import { TRANSMISSIONS, FUEL_TYPES, type ListingSummary } from '@/lib/types'

const STATUS_MAP: Record<ListingSummary['status'], 'available' | 'pending' | 'sold'> = {
  AV: 'available',
  PE: 'pending',
  SO: 'sold',
}

interface ListingResultsGridProps {
  listings: ListingSummary[]
  variant?: 'h' | 'v'
  // For variant="v" this is the number of grid columns (1-4). For variant="h"
  // it's either 1 (classic single-column stacked list) or 2 (two-column grid
  // of horizontal cards) -- horizontal cards are too wide to tile past 2.
  columns?: 1 | 2 | 3 | 4
  emptyMessage?: string
  className?: string
  // Username of whoever's viewing, if logged in -- lets each card know
  // whether it's showing the viewer's own listing (right-click menu with
  // Edit/Mark Sold/Mark Pending/Share/Hide) without a separate id lookup,
  // same comparison the listing detail and profile pages already use.
  currentUsername?: string
  // Opt-in for watchlist-style views (profile page's watchlist, /liked) --
  // unliking a card removes it from this grid immediately instead of just
  // toggling its heart icon while it stays put. Left off everywhere else
  // (home page's "Most Liked" section, general browse grids, etc.), where
  // unliking obviously shouldn't make a listing vanish from view.
  removeOnUnlike?: boolean
}

const V_GRID_COLUMNS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-3 xl:grid-cols-4',
}

export function ListingResultsGrid({ listings, variant = 'v', columns, emptyMessage, className, currentUsername, removeOnUnlike = false }: ListingResultsGridProps) {
  const t = useTranslations('ListingResultsGrid')
  const tAttr = useTranslations('VehicleAttributes')

  const [items, setItems] = useState(listings)
  // Keeps this in sync whenever the parent re-fetches/re-passes a different
  // `listings` array (e.g. filters changed, or the server round-tripped
  // after a router.refresh()) -- otherwise a stale local copy would linger
  // after the very first render.
  useEffect(() => {
    setItems(listings)
  }, [listings])

  if (items.length === 0) {
    return <p className="text-sm text-muted">{emptyMessage ?? t('noListingsFound')}</p>
  }

  const cols = columns ?? (variant === 'v' ? 3 : 1)

  const defaultClassName = variant === 'v'
    ? `grid ${V_GRID_COLUMNS[cols]} gap-4 items-stretch`
    : cols >= 2
      ? 'grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch'
      : 'flex flex-col gap-3'

  return (
    <div className={className ?? defaultClassName}>
      {items.map((listing) => {
        const thumb = listing.thumbnails?.[0]
        const location = [listing.seller.city, listing.seller.state].filter(Boolean).join(', ')

        return (
          <ListingCard
            key={listing.id}
            listingId={listing.id}
            slug={listing.slug}
            title={listing.title}
            img={thumb ? safeImageUrl(thumb.large_url, thumb.image_url) : ''}
            price={listing.price ?? undefined}
            year={listing.year}
            mileage={listing.mileage ?? undefined}
            transmission={listing.transmission ? labelFor(TRANSMISSIONS, listing.transmission, (code) => tAttr(`transmission.${code}`)) : undefined}
            fuelType={listing.fuel_type ? labelFor(FUEL_TYPES, listing.fuel_type, (code) => tAttr(`fuelType.${code}`)) : undefined}
            seller={sellerDisplayName(listing.seller)}
            sellerUsername={listing.seller.username}
            sellerVerified={listing.seller.is_verified}
            sellerHasPhone={listing.seller.has_phone}
            sellerEmail={listing.seller.email}
            hasWarranty={listing.has_warranty}
            vin={listing.vin}
            hasDamagePhotos={listing.has_damage_photos}
            hasCarfax={listing.has_carfax}
            location={location || undefined}
            distance={listing.distance ?? undefined}
            createdAt={listing.created_at}
            status={STATUS_MAP[listing.status]}
            isActive={listing.is_active}
            liked={listing.is_liked}
            likesCount={listing.likes_count}
            callCount={listing.call_count}
            viewsCount={listing.views_count}
            variant={variant}
            compact={variant === 'v' && cols === 4}
            isOwner={!!currentUsername && listing.seller.username === currentUsername}
            onUnlike={removeOnUnlike ? () => setItems(prev => prev.filter(l => l.id !== listing.id)) : undefined}
          />
        )
      })}
    </div>
  )
}
