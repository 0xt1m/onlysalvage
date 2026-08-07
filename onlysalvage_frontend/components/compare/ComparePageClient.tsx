'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { X, Check, Car, GitCompare, GripVertical } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Price } from '@/components/ui/Price'
import { Spinner } from '@/components/ui/Spinner'
import { Link } from '@/i18n/navigation'
import { getListing } from '@/lib/api'
import { getCompareList, removeFromCompareList } from '@/lib/compareList'
import { useDragReorder } from '@/lib/useDragReorder'
import { cn, formatMileage, labelFor, safeImageUrl, sellerDisplayName } from '@/lib/utils'
import { TRANSMISSIONS, FUEL_TYPES, DRIVES, COLORS, TITLE_DOCUMENTS } from '@/lib/types'
import type { Listing } from '@/lib/types'

// getListing() returns every photo unfiltered/unsorted (before/after-repair
// included), unlike the list endpoint's thumbnails -- picking images[0]
// directly can surface a damage photo as the cover image. Mirrors
// ListingListSerializer.get_thumbnails on the backend: gallery photos only,
// ordered the same way.
function coverPhotoFor(listing: Listing) {
  return listing.images
    .filter((img) => img.photo_type === 'gallery')
    .sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || a.id - b.id)[0]
}

export function ComparePageClient() {
  const t = useTranslations('ComparePage')
  const tAttr = useTranslations('VehicleAttributes')
  // Reusing ListingCard's own status/inactive labels rather than adding new
  // translation keys -- same strings, same meaning, just shown here instead
  // of on a card. Compare intentionally keeps sold/inactive listings (see
  // getCompareList) rather than dropping them, so this badge is the only
  // thing telling a viewer that's what they're looking at.
  const tCard = useTranslations('ListingCard')
  const locale = useLocale()

  const statusLabels: Record<'AV' | 'PE' | 'SO', string> = {
    AV: tCard('statusAvailable'),
    PE: tCard('statusPending'),
    SO: tCard('statusSold'),
  }

  // null while the initial localStorage-driven fetch is in flight -- an
  // empty array is a real, resolved "nothing to compare" state, so the two
  // can't share a single falsy check.
  const [listings, setListings] = useState<Listing[] | null>(null)
  // Reordering is purely local/visual (nothing about a vehicle's "position"
  // is persisted to compareList, it only stores which slugs are in the
  // set) -- called unconditionally, before the loading/empty early returns
  // below, since hooks can't be conditional.
  const { dragIndex, dragHandlers } = useDragReorder(listings ?? [], (next) => setListings(next))

  // A second, slim scrollbar mirrored above the table -- with enough cars
  // to compare, the real one (at the bottom of a possibly-tall table) can
  // be a long scroll down just to reach. The two stay in sync by copying
  // scrollLeft across on whichever one the user actually drags; a plain
  // spacer div sized to the table's real scrollWidth is what gives the top
  // bar something to scroll.
  const topScrollRef = useRef<HTMLDivElement>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const [tableScrollWidth, setTableScrollWidth] = useState(0)
  const syncingRef = useRef<'top' | 'table' | null>(null)

  useEffect(() => {
    const table = tableScrollRef.current?.querySelector('table')
    if (!table) return

    const measure = () => setTableScrollWidth(table.scrollWidth)
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(table)
    return () => observer.disconnect()
  }, [listings])

  const handleTopScroll = () => {
    if (syncingRef.current === 'table') { syncingRef.current = null; return }
    if (!topScrollRef.current || !tableScrollRef.current) return
    syncingRef.current = 'top'
    tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft
  }

  const handleTableScroll = () => {
    if (syncingRef.current === 'top') { syncingRef.current = null; return }
    if (!topScrollRef.current || !tableScrollRef.current) return
    syncingRef.current = 'table'
    topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft
  }

  useEffect(() => {
    const slugs = getCompareList()
    if (slugs.length === 0) {
      setListings([])
      return
    }

    Promise.all(slugs.map((slug) => getListing(slug))).then((results) => {
      results.forEach((result, i) => {
        // A slug that no longer resolves (sold/deleted since it was added)
        // would otherwise linger in localStorage forever.
        if (!result) removeFromCompareList(slugs[i])
      })
      setListings(results.filter((l): l is Listing => l !== null))
    })
  }, [])

  const handleRemove = (slug: string) => {
    removeFromCompareList(slug)
    setListings((prev) => (prev ? prev.filter((l) => l.slug !== slug) : prev))
  }

  const handleClearAll = () => {
    listings?.forEach((l) => removeFromCompareList(l.slug))
    setListings([])
  }

  if (listings === null) {
    return (
      <Card className="items-center py-12">
        <Spinner />
      </Card>
    )
  }

  if (listings.length === 0) {
    return (
      <Card className="items-center text-center gap-3 py-12">
        <GitCompare className="w-10 h-10 text-muted" />
        <h3 className="text-lg font-semibold">{t('emptyTitle')}</h3>
        <p className="text-muted text-sm max-w-sm">{t('emptyDescription')}</p>
        <Link href="/inventory">
          <Button>{t('browseInventory')}</Button>
        </Link>
      </Card>
    )
  }

  const rows: { key: string; label: string; value: (l: Listing) => React.ReactNode }[] = [
    { key: 'year', label: t('specs.year'), value: (l) => l.year ?? '—' },
    { key: 'mileage', label: t('specs.mileage'), value: (l) => (l.mileage != null ? formatMileage(l.mileage, locale) : '—') },
    { key: 'transmission', label: t('specs.transmission'), value: (l) => labelFor(TRANSMISSIONS, l.transmission, (c) => tAttr(`transmission.${c}`)) },
    { key: 'drive', label: t('specs.drive'), value: (l) => labelFor(DRIVES, l.drive, (c) => tAttr(`drive.${c}`)) },
    { key: 'fuelType', label: t('specs.fuelType'), value: (l) => labelFor(FUEL_TYPES, l.fuel_type, (c) => tAttr(`fuelType.${c}`)) },
    { key: 'engine', label: t('specs.engine'), value: (l) => l.engine || '—' },
    { key: 'cityMpg', label: t('specs.cityMpg'), value: (l) => l.city_mpg ?? '—' },
    { key: 'hwyMpg', label: t('specs.hwyMpg'), value: (l) => l.hwy_mpg ?? '—' },
    { key: 'exteriorColor', label: t('specs.exteriorColor'), value: (l) => l.exterior_color ? labelFor(COLORS, l.exterior_color, (c) => tAttr(`color.${c}`)) : '—' },
    { key: 'interiorColor', label: t('specs.interiorColor'), value: (l) => l.interior_color ? labelFor(COLORS, l.interior_color, (c) => tAttr(`color.${c}`)) : '—' },
    { key: 'titleStatus', label: t('specs.titleStatus'), value: (l) => labelFor(TITLE_DOCUMENTS, l.title_document, (c) => tAttr(`titleDocument.${c}`)) },
    { key: 'owners', label: t('specs.owners'), value: (l) => l.owners ?? '—' },
    {
      key: 'warranty',
      label: t('specs.warranty'),
      value: (l) => l.has_warranty
        ? <Check className="w-4 h-4 text-success" />
        : <span className="text-muted">—</span>,
    },
    { key: 'vin', label: t('specs.vin'), value: (l) => <span className="font-mono text-xs">{l.vin}</span> },
    {
      key: 'seller',
      label: t('specs.seller'),
      value: (l) => (
        <Link href={`/profile/${l.seller.username}`} className="hover:text-primary-light hover:underline">
          {sellerDisplayName(l.seller)}
        </Link>
      ),
    },
    {
      key: 'features',
      label: t('specs.features'),
      value: (l) => l.options.length > 0
        ? <span className="text-xs text-muted">{l.options.map((o) => o.label).join(', ')}</span>
        : <span className="text-muted">—</span>,
    },
  ]

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{t('comparingCount', { count: listings.length })}</p>
        <Button variant="ghost" size="sm" onClick={handleClearAll}>{t('clearAll')}</Button>
      </div>
      {listings.length > 1 && (
        <p className="flex items-center gap-1.5 text-xs text-muted -mt-1 mb-2">
          <GripVertical className="w-3.5 h-3.5 shrink-0" />
          {t('dragToReorder')}
        </p>
      )}

      {/* A second scrollbar mirrored above the table -- see the
          handleTopScroll/handleTableScroll sync above. Only worth showing
          once the table is actually wider than its container. */}
      {tableScrollWidth > 0 && (
        <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto overflow-y-hidden">
          <div style={{ width: tableScrollWidth, height: 1 }} />
        </div>
      )}

      {/* table-fixed + an explicit width on every header cell is what
          actually pins column widths -- without it, table-layout: auto
          sizes each column off its own content (e.g. a longer VIN or
          features list), so the image in each header cell -- itself only
          ever `w-full` of its own column -- rendered at a different size
          per car. */}
      <div ref={tableScrollRef} onScroll={handleTableScroll} className="overflow-x-auto">
      <table className="w-full border-collapse table-fixed">
        <thead>
          <tr>
            <th className="w-40 sticky left-0 z-20 bg-surface border-r border-border" />
            {listings.map((l, i) => {
              const cover = coverPhotoFor(l)
              return (
              <th
                key={l.id}
                {...dragHandlers(i)}
                className={cn(
                  'p-3 align-top text-left w-[220px] cursor-grab active:cursor-grabbing transition-opacity',
                  dragIndex === i && 'opacity-40'
                )}
              >
                <div className={cn(
                  'relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-surface-raised mb-2',
                  (l.status === 'SO' || !l.is_active) && 'opacity-60'
                )}>
                  {cover ? (
                    <Image
                      src={safeImageUrl(cover.large_url, cover.image_url)}
                      alt={l.title}
                      fill
                      className="object-cover pointer-events-none"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Car className="w-8 h-8 text-muted" />
                    </div>
                  )}
                  {((l.status === 'PE' || l.status === 'SO') || !l.is_active) && (
                    <div className="absolute left-2 bottom-2 flex items-center gap-1.5">
                      {(l.status === 'PE' || l.status === 'SO') && (
                        <Badge label={statusLabels[l.status]} variant={l.status === 'PE' ? 'warning' : 'error'} />
                      )}
                      {!l.is_active && <Badge label={tCard('inactiveBadge')} variant="error" />}
                    </div>
                  )}
                  <span className="absolute top-2 left-2 bg-black/50 text-white rounded-full p-1.5">
                    <GripVertical className="w-3.5 h-3.5" />
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(l.slug)}
                    aria-label={t('remove')}
                    className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Link href={`/inventory/${l.slug}`} className="font-semibold text-foreground hover:text-primary-light hover:underline block truncate">
                  {l.title}
                </Link>
                <Price value={l.price ?? undefined} />
              </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-border">
              <td className="w-40 p-3 text-sm font-medium text-muted whitespace-nowrap align-top sticky left-0 z-10 bg-surface border-r border-border">{row.label}</td>
              {listings.map((l) => (
                <td key={l.id} className="w-[220px] p-3 text-sm text-foreground align-top">{row.value(l)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </Card>
  )
}
