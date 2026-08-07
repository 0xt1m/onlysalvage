'use client'

import { useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Car } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Price } from '@/components/ui/Price'
import { Checkbox } from '@/components/ui/Checkbox'
import { Link } from '@/i18n/navigation'
import { updateListing } from '@/lib/api'
import { safeImageUrl } from '@/lib/utils'
import type { ListingSummary } from '@/lib/types'

const statusVariant: Record<ListingSummary['status'], 'success' | 'warning' | 'default'> = {
  AV: 'success',
  PE: 'warning',
  SO: 'default',
}

interface WarrantyListingsCardProps {
  listings: ListingSummary[]
  // False while "I offer a warranty on my vehicles" above is unchecked or
  // hasn't been saved yet -- the backend rejects has_warranty=true until
  // then (see ListingUpdateSerializer.validate), so the checkboxes here
  // stay disabled rather than letting a click fail with a server error.
  canToggle: boolean
}

export function WarrantyListingsCard({ listings: initialListings, canToggle }: WarrantyListingsCardProps) {
  const t = useTranslations('Settings')
  const tCard = useTranslations('ListingCard')
  const [listings, setListings] = useState(initialListings)

  const statusLabel: Record<ListingSummary['status'], string> = {
    AV: tCard('statusAvailable'),
    PE: tCard('statusPending'),
    SO: tCard('statusSold'),
  }

  const toggle = async (slug: string, checked: boolean) => {
    setListings(prev => prev.map(l => (l.slug === slug ? { ...l, has_warranty: checked } : l)))

    const { ok } = await updateListing(slug, { has_warranty: checked })
    if (!ok) {
      // Reverting has_warranty here only fixes the source of truth --
      // Checkbox tracks its own checked state internally (see its
      // defaultChecked prop), so remounting it via `key` below is what
      // actually makes the switch visually snap back on failure.
      setListings(prev => prev.map(l => (l.slug === slug ? { ...l, has_warranty: !checked } : l)))
      toast.error(t('warrantyUpdateFailed'))
    }
  }

  if (listings.length === 0) {
    return <p className="text-sm text-muted">{t('warrantyNoListings')}</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {listings.map(listing => (
        <div key={listing.id} className="flex items-center gap-3 border border-border rounded-md p-2">
          <Link
            href={`/inventory/${listing.slug}`}
            className="relative w-16 h-16 shrink-0 rounded overflow-hidden bg-surface-raised"
          >
            {listing.thumbnails?.[0] ? (
              <Image
                src={safeImageUrl(listing.thumbnails[0].thumb_url, listing.thumbnails[0].image_url)}
                alt={listing.title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Car className="w-6 h-6 text-muted" />
              </div>
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/inventory/${listing.slug}`} className="text-sm font-medium text-foreground truncate hover:underline block">
              {listing.title}
            </Link>
            <div className="flex items-center gap-2 mt-0.5">
              <Price value={listing.price ?? undefined} className="text-sm" />
              <Badge label={statusLabel[listing.status]} variant={statusVariant[listing.status]} />
            </div>
          </div>
          <Checkbox
            key={`${listing.slug}-${listing.has_warranty}`}
            label={t('warrantyIncluded')}
            defaultChecked={listing.has_warranty}
            onChange={(checked) => toggle(listing.slug, checked)}
            disabled={!canToggle}
          />
        </div>
      ))}
    </div>
  )
}
