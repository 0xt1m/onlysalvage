'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Link2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getDamagePhotosLink } from '@/lib/api'

interface CopyDamagePhotosLinkButtonProps {
  slug: string
}

// Owner-only -- the raw token never reaches a normal listing fetch (see
// ListingDetailSerializer.get_images), so this always hits the dedicated
// damage-photos-link endpoint fresh rather than reading it off already-loaded
// listing data.
export function CopyDamagePhotosLinkButton({ slug }: CopyDamagePhotosLinkButtonProps) {
  const t = useTranslations('ListingCard')
  const [copying, setCopying] = useState(false)

  const handleClick = async () => {
    setCopying(true)
    const result = await getDamagePhotosLink(slug)
    setCopying(false)

    if (!result) {
      toast.error(t('shareFailed'))
      return
    }

    try {
      await navigator.clipboard.writeText(result.url)
      toast.success(t('damagePhotosLinkCopied'))
    } catch {
      toast.error(t('shareFailed'))
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} disabled={copying} className="flex items-center justify-center gap-2 w-full">
      <Link2 className="w-4 h-4" />
      {t('copyDamagePhotosLink')}
    </Button>
  )
}
