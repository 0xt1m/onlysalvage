'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { renewListing } from '@/lib/api'
import { daysUntil } from '@/lib/utils'

// Kept in sync with Listing.MAX_RENEWALS on the backend -- once
// renewal_count hits this, can_renew is permanently false (not just
// cooldown-false), so this needs its own message rather than a countdown.
const MAX_RENEWALS = 3

interface RenewListingButtonProps {
  slug: string
  canRenew: boolean
  renewalAvailableAt: string
  renewalCount: number
}

export function RenewListingButton({ slug, canRenew, renewalAvailableAt, renewalCount }: RenewListingButtonProps) {
  const t = useTranslations('ListingDetail')
  const router = useRouter()
  const [renewing, setRenewing] = useState(false)

  if (renewalCount >= MAX_RENEWALS) {
    return <p className="text-xs text-muted print:hidden">{t('renewalsExhausted')}</p>
  }

  if (!canRenew) {
    return (
      <p className="text-xs text-muted print:hidden">
        {t('renewAvailableInDays', { count: daysUntil(renewalAvailableAt) })}
      </p>
    )
  }

  const handleRenew = async () => {
    setRenewing(true)
    const { ok } = await renewListing(slug)
    setRenewing(false)
    if (!ok) {
      toast.error(t('renewFailed'))
      return
    }
    toast.success(t('renewSucceeded'))
    router.refresh()
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={handleRenew}
      disabled={renewing}
      className="flex items-center gap-2 print:hidden"
    >
      {renewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
      {t('renewListing')}
    </Button>
  )
}
