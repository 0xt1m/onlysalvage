'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { InfoItem } from '@/components/ui/InfoItem'
import { Price } from '@/components/ui/Price'
import { Badge } from '@/components/ui/Badge'
import { LikeButton } from '@/components/ui/LikeButton'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu'
import { cn, formatDistance, formatMileage, formatTimeAgo, isLowMileage, localizedPath, phoneTelHref } from '@/lib/utils'
import { useLikeToggle } from '@/lib/useLikeToggle'
import { Link, useRouter } from '@/i18n/navigation'
import { updateListing, deleteListing, callSeller } from '@/lib/api'
import { ReportListingDialog } from '@/components/listing/ReportListingModal'
import { DeleteListingDialog } from '@/components/listing/DeleteListingModal'
import { addToCompareList, isInCompareList, removeFromCompareList } from '@/lib/compareList'
import { flyToCompareIcon, flyToWatchlistIcon } from '@/lib/flyToIcon'
import { useTranslations, useLocale } from 'next-intl'

import {
  MapPin, User, Gauge, Fuel, Car, Pencil, CheckCircle2, Clock, Circle, Copy,
  ExternalLink, Eye, EyeOff, Flag, Heart, HeartOff, Phone, Mail, GitCompare, Trash2,
} from "lucide-react"
import { IconManualGearbox } from "@tabler/icons-react"

interface ListingCardProps {
  listingId: number
  title: string
  img: string
  slug: string
  price?: number
  year?: number
  mileage?: number
  transmission?: string
  fuelType?: string
  seller?: string
  sellerUsername?: string
  sellerVerified?: boolean
  sellerHasPhone?: boolean
  sellerEmail?: string | null
  hasWarranty?: boolean
  location?: string
  distance?: number
  status?: 'available' | 'pending' | 'sold'
  // False for a listing its owner has paused (see the Published checkbox in
  // EditListingForm) -- only ever actually false here on the profile page's
  // own "My Listings" section (see ListingResultsGrid), since every other
  // listings fetch already filters is_active=true server-side.
  isActive?: boolean
  liked?: boolean
  likesCount?: number
  callCount?: number
  viewsCount?: number
  createdAt?: string | Date
  variant?: 'h' | 'v'
  compact?: boolean
  isOwner?: boolean
  onClick?: () => void
  className?: string
  // Fired the moment this card gets unliked (heart button or the "Remove
  // from Watchlist" menu item) -- lets a watchlist-style parent grid drop
  // it from view right away instead of leaving a now-irrelevant card
  // sitting there until the next full page load. See ListingResultsGrid's
  // removeOnUnlike.
  onUnlike?: () => void
}

const STATUS_CODE: Record<'available' | 'pending' | 'sold', 'AV' | 'PE' | 'SO'> = {
  available: 'AV',
  pending: 'PE',
  sold: 'SO',
}

export function ListingCard({ listingId, title, img, slug, price, year, mileage, transmission, fuelType, seller, sellerUsername, sellerVerified, sellerHasPhone, sellerEmail, hasWarranty, location, distance, status = 'available', isActive = true, liked = false, likesCount = 0, callCount, viewsCount, variant = 'h', compact = false, createdAt, isOwner = false, className, onUnlike }: ListingCardProps) {
  const { liked: isLiked, likesCount: count, toggle } = useLikeToggle(listingId, liked, likesCount)
  const t = useTranslations('ListingCard')
  const locale = useLocale()
  const router = useRouter()
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [reporting, setReporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [inCompare, setInCompare] = useState(false)
  const lowMileage = year !== undefined && isLowMileage(year, mileage)

  useEffect(() => {
    setInCompare(isInCompareList(slug))
  }, [slug])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const handleCompareToggle = () => {
    if (inCompare) {
      removeFromCompareList(slug)
      setInCompare(false)
      toast.success(t('removedFromCompare'))
      return
    }
    addToCompareList(slug)
    setInCompare(true)
    // Right-click position -- still the last thing `menu` was set to, since
    // this only ever runs from that same context menu's "Add to Compare" item.
    if (menu) flyToCompareIcon(menu.x, menu.y)
    toast.success(t('addedToCompare'))
  }

  const handleLikeToggle = (next: boolean) => {
    toggle(next)
    if (!next) onUnlike?.()
  }

  const setListingStatus = async (newStatus: 'AV' | 'SO' | 'PE') => {
    const { ok } = await updateListing(slug, { status: newStatus })
    if (!ok) {
      toast.error(t('statusUpdateFailed'))
      return
    }
    toast.success(t('statusUpdateSucceeded'))
    router.refresh()
  }

  const handleOpenInNewTab = () => {
    window.open(localizedPath(locale, `/inventory/${slug}`), '_blank', 'noopener,noreferrer')
  }

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${localizedPath(locale, `/inventory/${slug}`)}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('linkCopied'))
    } catch {
      toast.error(t('shareFailed'))
    }
  }

  // Reversible -- unlike Delete (see DeleteListingDialog), this just flips
  // is_active (same PATCH mechanism as the mark-available/pending/sold
  // actions below), same as the Published checkbox in EditListingForm.
  // Doesn't touch status at all -- a paused listing keeps whatever real
  // status it had (see the Inactive badge, ListingResultsGrid).
  const handleTogglePublish = async (nextActive: boolean) => {
    const { ok } = await updateListing(slug, { is_active: nextActive })
    if (!ok) {
      toast.error(nextActive ? t('publishFailed') : t('unpublishFailed'))
      return
    }
    toast.success(nextActive ? t('publishSucceeded') : t('unpublishSucceeded'))
    router.refresh()
  }

  const handleCall = async () => {
    const result = await callSeller(listingId)
    if (!result?.phone) {
      toast.error(t('callFailed'))
      return
    }
    window.location.href = phoneTelHref(result.phone)
  }

  const handleEmail = () => {
    window.location.href = `mailto:${sellerEmail}`
  }

  const currentStatusCode = STATUS_CODE[status]

  const compareMenuItem: ContextMenuItem = {
    label: inCompare ? t('removeFromCompare') : t('addToCompare'),
    icon: GitCompare,
    onClick: handleCompareToggle,
  }

  const ownerMenuItems: ContextMenuItem[] = [
    { label: t('openInNewTab'), icon: ExternalLink, onClick: handleOpenInNewTab },
    { label: t('share'), icon: Copy, onClick: handleCopyLink },
    compareMenuItem,
    { label: t('editListing'), icon: Pencil, onClick: () => router.push(`/inventory/${slug}/edit`) },
    ...(currentStatusCode !== 'AV' ? [{ label: t('markAvailable'), icon: Circle, onClick: () => setListingStatus('AV') }] : []),
    ...(currentStatusCode !== 'PE' ? [{ label: t('markPending'), icon: Clock, onClick: () => setListingStatus('PE') }] : []),
    ...(currentStatusCode !== 'SO' ? [{ label: t('markSold'), icon: CheckCircle2, onClick: () => setListingStatus('SO') }] : []),
    isActive
      ? { label: t('unpublish'), icon: EyeOff, onClick: () => handleTogglePublish(false) }
      : { label: t('publish'), icon: Eye, onClick: () => handleTogglePublish(true) },
    { label: t('deleteListing'), icon: Trash2, onClick: () => setDeleting(true), danger: true },
  ]

  const visitorMenuItems: ContextMenuItem[] = [
    { label: t('openInNewTab'), icon: ExternalLink, onClick: handleOpenInNewTab },
    { label: t('share'), icon: Copy, onClick: handleCopyLink },
    compareMenuItem,
    {
      label: isLiked ? t('removeFromWatchlist') : t('addToWatchlist'),
      icon: isLiked ? HeartOff : Heart,
      onClick: () => {
        // Right-click position -- same reasoning as compareMenuItem above.
        // Doesn't go through LikeButton (which fires this for its own
        // overlay heart click), so it needs its own trigger here.
        if (!isLiked && menu) flyToWatchlistIcon(menu.x, menu.y)
        handleLikeToggle(!isLiked)
      },
    },
    ...(sellerHasPhone ? [{ label: t('callSeller'), icon: Phone, onClick: handleCall }] : []),
    ...(sellerEmail ? [{ label: t('emailSeller'), icon: Mail, onClick: handleEmail }] : []),
    { label: t('report'), icon: Flag, onClick: () => setReporting(true) },
    ...(sellerUsername
      ? [{ label: t('viewSellerProfile'), icon: User, onClick: () => router.push(`/profile/${sellerUsername}`) }]
      : []),
  ]

  const statusLabels: Record<typeof status, string> = {
    available: t('statusAvailable'),
    pending: t('statusPending'),
    sold: t('statusSold'),
  }

  const specs = (
    <>
      <InfoItem icon={Gauge} label={t('mileage')} hideLabelOnMobile value={mileage !== undefined ? formatMileage(mileage, locale) : t('contactSeller')} />
      <InfoItem icon={IconManualGearbox} label={t('transmission')} hideLabelOnMobile value={transmission ?? t('contactSeller')} />
      <InfoItem icon={Fuel} label={t('fuelType')} hideLabelOnMobile value={fuelType ?? t('contactSeller')} />
      {!compact && seller && <InfoItem icon={User} label={t('seller')} value={seller} />}
      {!compact && (distance != null || location) && (
        <InfoItem
          icon={MapPin}
          label={t('location')}
          value={distance != null ? formatDistance(distance, locale) : location!}
        />
      )}
    </>
  )

  return (
    <div onContextMenu={handleContextMenu} className={cn('relative h-full', className)}>
      {/* The opacity dimming (sold/paused) belongs on this inner wrapper,
          not the outer one -- CSS opacity dims a whole subtree, and the
          context menu/dialogs below render as this component's own DOM
          children (not a portal), so putting it on the outer div made a
          perfectly normal right-click menu look washed out too. */}
      <div className={cn(
        'relative rounded-lg overflow-hidden bg-surface hover:bg-surface-raised shadow-sm hover:shadow-md transition-all cursor-pointer group h-full',
        // Owner's own listings get a distinct, thicker border so they stand
        // out while scrolling a browse grid that's otherwise full of
        // everyone else's cars -- box-sizing: border-box (Tailwind's
        // preflight default) keeps the extra width from shifting layout.
        isOwner ? 'border-2 border-primary-light' : 'border border-border',
        variant === 'v' ? 'flex flex-col w-full' : 'flex flex-col sm:flex-row',
        // Sold/paused listings are no longer actionable, so they read as
        // background/archival among a seller's active inventory.
        (status === 'sold' || !isActive) && 'opacity-60'
      )}>
      <Link href={`/inventory/${slug}`} className="block absolute inset-0 z-10" aria-label={title} />

      <div className={cn(
        'relative shrink-0 overflow-hidden bg-surface-raised',
        variant === 'v' ? 'w-full aspect-[4/3]' : 'w-full sm:w-72 aspect-[4/3] sm:aspect-auto sm:min-h-[220px]'
      )}>
        {img ? (
          <Image
            src={img}
            alt={title}
            fill
            quality={90}
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
            <Car className="w-10 h-10 text-muted" />
            <span className="text-xs text-muted">{t('noPhotoYet')}</span>
          </div>
        )}
        <div className="absolute left-2 top-2 z-20 flex items-center gap-1.5">
          <LikeButton className={compact ? 'p-1.5' : 'p-2'} liked={isLiked} onToggle={handleLikeToggle} showTooltip={false} />
          {count > 0 && (
            <span className="bg-black/50 text-white text-xs font-medium px-2 py-1 rounded-full">
              {count}
            </span>
          )}
        </div>
        {(status !== 'available' || !isActive) && (
          <div className="absolute left-2 bottom-2 flex items-center gap-1.5">
            {status !== 'available' && (
              <Badge label={statusLabels[status]} variant={status === 'pending' ? 'warning' : 'error'} />
            )}
            {!isActive && <Badge label={t('inactiveBadge')} variant="error" />}
          </div>
        )}
        {lowMileage && (
          <Badge
            label={t('lowMileage')}
            className="absolute right-2 top-2"
            variant="success"
          />
        )}
        {(sellerVerified || hasWarranty) && (
          // flex-wrap (not nowrap) -- some locales' translated labels are
          // long enough that both badges side by side overflow a small
          // card's width, so this drops the second one to its own line
          // instead of spilling past the image, right-aligned in both cases.
          <div className="absolute right-2 bottom-2 max-w-[calc(100%-1rem)] flex flex-wrap items-end justify-end gap-1.5">
            {hasWarranty && <Badge label={t('warrantyBadge')} variant="success" />}
            {sellerVerified && <Badge label={t('verifiedSeller')} variant="primary" />}
          </div>
        )}
      </div>

      <div className={cn(
        'flex flex-col flex-1 min-w-0 @container',
        compact ? 'p-3 gap-2' : variant === 'h' ? 'p-4 justify-between' : 'p-4 gap-3'
      )}>
        <div className="flex flex-col gap-0.5">
          <h3 className={cn('font-semibold text-foreground truncate', compact ? 'text-base' : 'text-lg')}>{title}</h3>
          <Price value={price} />
        </div>

        {/* @sm here is a container query (keyed to this card's own info-column
            width via @container above), not the viewport -- a 2-up horizontal
            card is still on a wide viewport but its info column is narrow, so
            a viewport sm: would wrongly force 2 sub-columns and truncate everything. */}
        <div className={cn(
          'grid gap-x-6',
          variant === 'v' ? 'grid-cols-1 gap-y-1.5' : 'grid-cols-1 @sm:grid-cols-2 gap-y-1.5'
        )}>
          {specs}
        </div>

        {/* Call count (bottom-left) and the timestamp (bottom-right) share
            one row pinned to the card's bottom -- mt-auto here (rather than
            on the timestamp alone) is what keeps them together regardless
            of how much specs/space is above them. */}
        {((isOwner && (callCount !== undefined || viewsCount !== undefined)) || createdAt !== undefined) && (
          <div className="flex items-center flex-wrap justify-between gap-x-3 gap-y-1 mt-auto">
            {isOwner && (callCount !== undefined || viewsCount !== undefined) ? (
              <span className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                {callCount !== undefined && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 shrink-0" />
                    {t('callsReceived', { count: callCount })}
                  </span>
                )}
                {viewsCount !== undefined && (
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3 h-3 shrink-0" />
                    {t('viewsCount', { count: viewsCount })}
                  </span>
                )}
              </span>
            ) : <span />}
            {createdAt !== undefined && (
              <span className="text-muted text-xs">{formatTimeAgo(createdAt, locale)}</span>
            )}
          </div>
        )}
      </div>
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={isOwner ? ownerMenuItems : visitorMenuItems} onClose={() => setMenu(null)} />
      )}

      {reporting && <ReportListingDialog slug={slug} onClose={() => setReporting(false)} />}
      {deleting && (
        <DeleteListingDialog
          slug={slug}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            setDeleting(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
