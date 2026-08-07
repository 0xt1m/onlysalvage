'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { updateListing } from '@/lib/api'

interface PublishToggleButtonProps {
  slug: string
  isActive: boolean
  // 'sm'/full-width fits the listing detail page's owner actions grid
  // (alongside the other action buttons there); 'lg'/natural-width fits
  // EditListingForm's bottom action bar (alongside Save Draft/Save Changes,
  // neither of which is full-width there).
  size?: 'sm' | 'lg'
  fullWidth?: boolean
  // Only fires on the unpublish direction (isActive true -> false), not on
  // publish -- e.g. EditListingForm sends the owner back to their profile
  // instead of leaving them on the edit page for a listing they just took
  // down. Defaults to just refreshing in place (the listing detail page's
  // own usage -- staying put still makes sense there either direction).
  onUnpublished?: () => void
}

// The only way left to flip is_active (see EditListingForm, which used to
// have a separate "Published" checkbox for this -- removed in favor of this
// same instant toggle everywhere). Never touches status at all -- a paused
// listing keeps whatever real status (AVAILABLE/PENDING/SOLD) it had.
export function PublishToggleButton({ slug, isActive, size = 'sm', fullWidth = true, onUnpublished }: PublishToggleButtonProps) {
  const router = useRouter()
  const t = useTranslations('ListingCard')
  const tUpdating = useTranslations('ListingStatusButton')
  const [submitting, setSubmitting] = useState(false)

  const handleClick = async () => {
    setSubmitting(true)
    const { ok } = await updateListing(slug, { is_active: !isActive })
    setSubmitting(false)

    if (!ok) {
      toast.error(isActive ? t('unpublishFailed') : t('publishFailed'))
      return
    }

    toast.success(isActive ? t('unpublishSucceeded') : t('publishSucceeded'))
    if (isActive && onUnpublished) {
      onUnpublished()
    } else {
      router.refresh()
    }
  }

  const Icon = isActive ? EyeOff : Eye

  return (
    <Button
      variant="secondary"
      size={size}
      onClick={handleClick}
      disabled={submitting}
      className={cn('flex items-center justify-center gap-2', fullWidth && 'w-full')}
    >
      <Icon className="w-4 h-4" />
      {submitting ? tUpdating('updating') : (isActive ? t('unpublish') : t('publish'))}
    </Button>
  )
}
