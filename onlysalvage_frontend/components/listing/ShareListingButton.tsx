'use client'

import { Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'

interface ShareListingButtonProps {
  title: string
}

export function ShareListingButton({ title }: ShareListingButtonProps) {
  const t = useTranslations('ListingDetail')

  const handleShare = async () => {
    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        // User dismissed the native share sheet -- not an error.
      }
      return
    }

    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('linkCopied'))
    } catch {
      toast.error(t('shareFailed'))
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleShare}
      className="w-full flex items-center justify-center gap-2 print:hidden"
    >
      <Share2 className="w-4 h-4" />
      {t('share')}
    </Button>
  )
}
