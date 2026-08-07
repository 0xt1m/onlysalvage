'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { deleteListing } from '@/lib/api'

interface DeleteListingDialogProps {
  slug: string
  onClose: () => void
  onDeleted: () => void
}

// Confirms before calling the actually-irreversible delete (as opposed to
// "Hide", which is just a reversible is_active=false and needs no
// confirmation at all) -- same shape as DeleteAccountButton's own dialog.
export function DeleteListingDialog({ slug, onClose, onDeleted }: DeleteListingDialogProps) {
  const t = useTranslations('DeleteListingModal')
  const [submitting, setSubmitting] = useState(false)

  const close = () => {
    if (submitting) return
    onClose()
  }

  const handleDelete = async () => {
    setSubmitting(true)
    const { ok } = await deleteListing(slug)
    setSubmitting(false)

    if (!ok) {
      toast.error(t('deleteFailed'))
      return
    }

    toast.success(t('deleteSucceeded'))
    onDeleted()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface border border-border rounded-lg w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('confirmTitle')}</h3>
          <button onClick={close} className="relative group text-muted hover:text-foreground cursor-pointer" aria-label={t('close')}>
            <X className="w-5 h-5" />
            <span className="pointer-events-none absolute right-0 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
              {t('close')}
            </span>
          </button>
        </div>

        <p className="text-sm text-muted">
          {t('confirmDescription')}
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="bg-error hover:bg-error text-white"
          >
            {submitting ? t('deleting') : t('deleteListing')}
          </Button>
        </div>
      </div>
    </div>
  )
}
