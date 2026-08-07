'use client'

import { useState } from 'react'
import { Link, useRouter } from '@/i18n/navigation'
import { useTranslations, useLocale } from 'next-intl'
import {
  Star, MapPin, Car, BadgeCheck, ExternalLink, Copy, Pencil, MessageSquarePlus, Flag, Phone, Mail,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu'
import { LeaveReviewDialog } from '@/components/profile/LeaveReviewModal'
import { ReportSellerDialog } from '@/components/profile/ReportSellerModal'
import { toast } from 'sonner'
import { callSellerProfile } from '@/lib/api'
import { sellerDisplayName, localizedPath, formatAddress, phoneTelHref } from '@/lib/utils'

interface SellerCardProps {
  username: string
  business_name?: string
  is_dealer: boolean
  is_verified?: boolean
  offers_financing?: boolean
  city?: string
  state?: string
  street_address?: string | null
  zip_code?: string | null
  profile_picture?: string | null
  has_phone?: boolean
  email?: string | null
  avg_rating: number | null
  review_count: number
  listings_count?: number
  // Username of whoever's viewing, if logged in -- lets the card tell its
  // own profile apart from someone else's (Edit Profile vs Leave a
  // Review/Report), same comparison used for listing cards' owner menu.
  currentUsername?: string
}

export function SellerCard({
  username, business_name, is_dealer, is_verified, offers_financing, city, state, street_address, zip_code,
  profile_picture, has_phone, email, avg_rating, review_count, listings_count, currentUsername,
}: SellerCardProps) {
  const t = useTranslations('SellerCard')
  const locale = useLocale()
  const router = useRouter()
  const location = [city, state].filter(Boolean).join(', ')
  const displayName = sellerDisplayName({ username, business_name, is_dealer })
  // Exact street address is dealer-only -- mirrors the profile page, which
  // also only ever shows it for dealers (it's already blank at the model
  // level for anyone else, but this keeps intent explicit here too).
  const address = formatAddress(is_dealer ? { street_address, city, state, zip_code } : { city, state })

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [reporting, setReporting] = useState(false)

  const isSelf = !!currentUsername && currentUsername === username
  const isLoggedIn = !!currentUsername

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const handleOpenInNewTab = () => {
    window.open(localizedPath(locale, `/profile/${username}`), '_blank', 'noopener,noreferrer')
  }

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${localizedPath(locale, `/profile/${username}`)}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('linkCopied'))
    } catch {
      toast.error(t('shareFailed'))
    }
  }

  const handleCall = async () => {
    const result = await callSellerProfile(username)
    if (!result?.phone) {
      toast.error(t('callFailed'))
      return
    }
    window.location.href = phoneTelHref(result.phone)
  }

  const handleEmail = () => {
    window.location.href = `mailto:${email}`
  }

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(address)
      toast.success(t('addressCopied'))
    } catch {
      toast.error(t('addressCopyFailed'))
    }
  }

  const menuItems: ContextMenuItem[] = [
    { label: t('openInNewTab'), icon: ExternalLink, onClick: handleOpenInNewTab },
    { label: t('share'), icon: Copy, onClick: handleCopyLink },
    // Call/Email/Copy Address are ways to contact this seller -- never
    // meaningful on your own card, regardless of what contact info you've
    // made public.
    ...(!isSelf && has_phone ? [{ label: t('callSeller'), icon: Phone, onClick: handleCall }] : []),
    ...(!isSelf && email ? [{ label: t('emailSeller'), icon: Mail, onClick: handleEmail }] : []),
    ...(!isSelf && address ? [{ label: t('copyAddress'), icon: MapPin, onClick: handleCopyAddress }] : []),
    ...(isSelf
      ? [{ label: t('editProfile'), icon: Pencil, onClick: () => router.push('/settings') }]
      : []),
    ...(!isSelf && isLoggedIn
      ? [
          { label: t('leaveReview'), icon: MessageSquarePlus, onClick: () => setReviewing(true) },
          { label: t('reportSeller'), icon: Flag, onClick: () => setReporting(true) },
        ]
      : []),
  ]

  return (
    <>
      <Link
        href={`/profile/${username}/`}
        onContextMenu={handleContextMenu}
        className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-surface-raised transition-colors"
      >
        <Avatar src={profile_picture ?? undefined} name={displayName} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{displayName}</span>
            {is_verified && (
              <span title={t('verifiedBadge')}>
                <BadgeCheck className="w-4 h-4 text-primary-light shrink-0" aria-label={t('verifiedBadge')} />
              </span>
            )}
            {is_dealer && <Badge label={t('dealerBadge')} variant="primary" />}
            {is_dealer && offers_financing && <Badge label={t('financingBadge')} variant="success" />}
          </div>

          <div className="flex items-center gap-3 text-sm text-muted flex-wrap">
            {avg_rating !== null ? (
              <span className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-warning text-warning" />
                <span className="font-medium text-foreground">{avg_rating.toFixed(1)}</span>
                <span>({review_count})</span>
              </span>
            ) : (
              <span>{t('noReviewsYet')}</span>
            )}

            {listings_count !== undefined && (
              <span className="flex items-center gap-1">
                <Car className="w-3.5 h-3.5" />
                {t('listingsCount', { count: listings_count })}
              </span>
            )}
          </div>

          {location && (
            <span className="flex items-center gap-1 text-xs text-muted mt-0.5">
              <MapPin className="w-3 h-3" />
              {location}
            </span>
          )}
        </div>
      </Link>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}

      {reviewing && <LeaveReviewDialog username={username} onClose={() => setReviewing(false)} />}
      {reporting && <ReportSellerDialog username={username} onClose={() => setReporting(false)} />}
    </>
  )
}
