'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Loader2, Trash2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { DraftListingCard } from '@/components/profile/DraftListingCard'
import { updateListing, deleteListing } from '@/lib/api'
import type { ListingSummary } from '@/lib/types'

interface DraftsSectionProps {
  drafts: ListingSummary[]
}

// Selecting nothing means "act on all of them" -- Publish All/Delete All are
// really just Publish Selected/Delete Selected with an implicit select-all,
// so there's one code path for both rather than two near-duplicate ones.
export function DraftsSection({ drafts }: DraftsSectionProps) {
  const t = useTranslations('Profile')
  const router = useRouter()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  // Bumped after every bulk action to force the (uncontrolled) checkboxes
  // to remount unchecked -- Checkbox only reads defaultChecked once, so
  // there's no prop that would otherwise un-tick them to match `selected`
  // being cleared.
  const [resetKey, setResetKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (drafts.length === 0) {
    return <p className="text-sm text-muted">{t('draftsEmptyMessage')}</p>
  }

  const hasSelection = selected.size > 0
  const targets = hasSelection ? drafts.filter((d) => selected.has(d.id)) : drafts

  const clearSelection = () => {
    setSelected(new Set())
    setResetKey((k) => k + 1)
  }

  const handlePublish = async () => {
    setBusy(true)
    const results = await Promise.all(targets.map((d) => updateListing(d.slug, { status: 'AV' })))
    setBusy(false)

    const succeeded = results.filter((r) => r.ok).length
    const failed = results.length - succeeded
    if (succeeded > 0) toast.success(t('bulkPublishSucceeded', { count: succeeded }))
    if (failed > 0) toast.error(t('bulkPublishFailed', { count: failed }))

    clearSelection()
    router.refresh()
  }

  const handleDelete = async () => {
    setBusy(true)
    const results = await Promise.all(targets.map((d) => deleteListing(d.slug)))
    setBusy(false)
    setConfirmingDelete(false)

    const succeeded = results.filter((r) => r.ok).length
    const failed = results.length - succeeded
    if (succeeded > 0) toast.success(t('bulkDeleteSucceeded', { count: succeeded }))
    if (failed > 0) toast.error(t('bulkDeleteFailed', { count: failed }))

    clearSelection()
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handlePublish}
          disabled={busy}
          className="flex items-center gap-1.5"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {hasSelection ? t('publishSelected', { count: selected.size }) : t('publishAll')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirmingDelete(true)}
          disabled={busy}
          className="text-error hover:text-error flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {hasSelection ? t('deleteSelected', { count: selected.size }) : t('deleteAll')}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {drafts.map((draft) => (
          <div key={`${draft.id}-${resetKey}`} className="flex items-center gap-1">
            <Checkbox
              aria-label={t('selectDraft', { title: draft.title })}
              defaultChecked={selected.has(draft.id)}
              onChange={(checked) =>
                setSelected((prev) => {
                  const next = new Set(prev)
                  if (checked) next.add(draft.id)
                  else next.delete(draft.id)
                  return next
                })
              }
              className="shrink-0"
            />
            <div className="flex-1 min-w-0">
              <DraftListingCard draft={draft} onDeleted={() => router.refresh()} />
            </div>
          </div>
        ))}
      </div>

      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface border border-border rounded-lg w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t('bulkDeleteConfirmTitle', { count: targets.length })}</h3>
              <button
                onClick={() => !busy && setConfirmingDelete(false)}
                className="relative group text-muted hover:text-foreground cursor-pointer"
                aria-label={t('close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted">{t('bulkDeleteConfirmDescription', { count: targets.length })}</p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setConfirmingDelete(false)} disabled={busy}>
                {t('cancel')}
              </Button>
              <Button type="button" onClick={handleDelete} disabled={busy} className="bg-error hover:bg-error text-white">
                {busy ? t('deleting') : t('deleteSelected', { count: targets.length })}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
