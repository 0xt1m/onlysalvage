'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Car, Pencil, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Link, useRouter } from '@/i18n/navigation'
import { DeleteListingDialog } from '@/components/listing/DeleteListingModal'
import { safeImageUrl } from '@/lib/utils'
import type { ListingSummary } from '@/lib/types'

// A saved-but-unpublished listing (see Listing.draft_saved on the backend)
// -- deliberately its own small component rather than reusing ListingCard,
// since a draft can be missing everything ListingCard assumes is always
// present (year, price, a real status), and its actions are different
// (resume editing / delete, not view / compare / like).
export function DraftListingCard({ draft, onDeleted }: { draft: ListingSummary; onDeleted?: () => void }) {
  const t = useTranslations('Profile')
  const locale = useLocale()
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const thumb = draft.thumbnails[0]

  return (
    <Card className="flex-row items-center gap-3 p-3">
      <div className="relative w-20 h-16 shrink-0 rounded-md overflow-hidden bg-background border border-border flex items-center justify-center">
        {thumb ? (
          <Image src={safeImageUrl(thumb.thumb_url, thumb.image_url)} alt={draft.title} fill className="object-cover" />
        ) : (
          <Car className="w-6 h-6 text-muted" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{draft.title}</p>
        <p className="text-xs text-muted">
          {t('draftStarted', { date: new Date(draft.created_at).toLocaleDateString(locale) })}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link href={`/inventory/${draft.slug}/edit`}>
          <Button variant="secondary" size="sm" className="flex items-center gap-1.5">
            <Pencil className="w-3.5 h-3.5" />
            {t('continueDraft')}
          </Button>
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setDeleting(true)}
          aria-label={t('deleteDraft')}
          className="text-error hover:text-error"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {deleting && (
        <DeleteListingDialog
          slug={draft.slug}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            setDeleting(false)
            onDeleted?.()
            router.refresh()
          }}
        />
      )}
    </Card>
  )
}
