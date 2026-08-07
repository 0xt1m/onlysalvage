'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { updateListing } from '@/lib/api'

interface ListingStatusButtonProps {
  slug: string
  status: 'AV' | 'PE' | 'SO'
  label: string
}

export function ListingStatusButton({ slug, status, label }: ListingStatusButtonProps) {
  const router = useRouter()
  const t = useTranslations('ListingStatusButton')
  const [submitting, setSubmitting] = useState(false)

  const handleClick = async () => {
    setSubmitting(true)
    const { ok } = await updateListing(slug, { status })
    setSubmitting(false)

    if (!ok) {
      toast.error(t('updateFailed'))
      return
    }

    toast.success(t('updateSucceeded'))
    router.refresh()
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleClick}
      disabled={submitting}
      className="w-full flex items-center justify-center gap-2"
    >
      <Check className="w-4 h-4" />
      {submitting ? t('updating') : label}
    </Button>
  )
}
