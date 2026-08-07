'use client'

import { useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { useLocale, useTranslations } from 'next-intl'
import { Car, Loader2, Pencil, Trash2, Upload } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Link, useRouter } from '@/i18n/navigation'
import { DeleteListingDialog } from '@/components/listing/DeleteListingModal'
import { safeImageUrl } from '@/lib/utils'
import { updateListing } from '@/lib/api'
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
  const [publishing, setPublishing] = useState(false)
  const thumb = draft.thumbnails[0]

  // No client-side "is this ready" precheck -- ListingUpdateSerializer.validate
  // is the single source of truth for what publishing requires (year/make/
  // model/price, at least one photo, all photos finished processing), and
  // ListingSummary doesn't carry enough of that to duplicate the check
  // accurately anyway. Attempting the publish IS the readiness check; a
  // draft that isn't ready yet just surfaces exactly why via the toast.
  const handlePublish = async () => {
    setPublishing(true)
    const { ok, data } = await updateListing(draft.slug, { status: 'AV' })
    setPublishing(false)

    if (!ok) {
      const firstError = data && typeof data === 'object' ? Object.values(data)[0] : null
      toast.error(Array.isArray(firstError) ? firstError[0] : t('publishFailed'))
      return
    }

    toast.success(t('publishSucceeded'))
    router.refresh()
  }

  return (
    <Card
      className="flex-row items-center gap-3 p-3 cursor-pointer hover:border-primary transition-colors"
      onClick={() => router.push(`/inventory/${draft.slug}/edit`)}
    >
      <div className="relative w-20 h-16 shrink-0 rounded-md overflow-hidden bg-background border border-border flex items-center justify-center">
        {thumb ? (
          <Image src={safeImageUrl(thumb.thumb_url, thumb.image_url)} alt={draft.title} fill sizes="80px" className="object-cover" />
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

      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
        <Link href={`/inventory/${draft.slug}/edit`}>
          <Button variant="secondary" size="sm" className="flex items-center gap-1.5">
            <Pencil className="w-3.5 h-3.5" />
            {t('continueDraft')}
          </Button>
        </Link>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handlePublish}
          disabled={publishing}
          className="flex items-center gap-1.5"
        >
          {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {t('publishDraft')}
        </Button>
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
