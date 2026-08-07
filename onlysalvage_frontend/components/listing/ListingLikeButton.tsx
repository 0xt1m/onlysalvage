'use client'

import { useTranslations } from 'next-intl'
import { LikeButton } from '@/components/ui/LikeButton'
import { useLikeToggle } from '@/lib/useLikeToggle'

interface ListingLikeButtonProps {
  listingId: number
  initialLiked: boolean
  initialLikesCount: number
}

export function ListingLikeButton({ listingId, initialLiked, initialLikesCount }: ListingLikeButtonProps) {
  const t = useTranslations('ListingLikeButton')
  const { liked, likesCount, toggle } = useLikeToggle(listingId, initialLiked, initialLikesCount)

  return (
    <div className="flex items-center gap-2 print:hidden">
      <LikeButton liked={liked} onToggle={toggle} />
      <span className="text-sm text-muted">
        {t('likesCount', { count: likesCount })}
      </span>
    </div>
  )
}
