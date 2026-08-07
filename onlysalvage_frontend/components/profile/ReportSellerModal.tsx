'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Flag, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { reportSeller } from '@/lib/api'
import { SELLER_REPORT_REASONS } from '@/lib/types'
import { translateOptions } from '@/lib/utils'

interface ReportSellerDialogProps {
  username: string
  onClose: () => void
}

// Controlled dialog -- both the "Report" button on a seller's own profile
// page (ReportSellerModal below) and a seller card's right-click menu open
// this same dialog, just from different triggers.
export function ReportSellerDialog({ username, onClose }: ReportSellerDialogProps) {
  const t = useTranslations('ReportSellerModal')
  const tReason = useTranslations('ReportReasons')

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [error, setError] = useState('')

  const close = () => {
    if (submitting) return
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason) {
      setError(t('reasonRequired'))
      return
    }

    setSubmitting(true)
    const { ok } = await reportSeller(username, reason, details.trim())
    setSubmitting(false)

    if (!ok) {
      toast.error(t('submitFailed'))
      return
    }

    setSubmitted(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface border border-border rounded-lg w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('title')}</h3>
          <button onClick={close} className="relative group text-muted hover:text-foreground cursor-pointer" aria-label={t('close')}>
            <X className="w-5 h-5" />
            <span className="pointer-events-none absolute right-0 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
              {t('close')}
            </span>
          </button>
        </div>

        {submitted ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-foreground">{t('submitSucceeded')}</p>
            <div className="flex justify-end">
              <Button type="button" onClick={close}>{t('done')}</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Select
              label={t('reasonLabel')}
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError('') }}
              options={translateOptions(SELLER_REPORT_REASONS, (code) => tReason(code))}
              placeholder={t('reasonPlaceholder')}
              error={error}
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm text-foreground">{t('detailsLabel')}</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={4}
                placeholder={t('detailsPlaceholder')}
                className="bg-surface border border-border rounded-md px-3 py-2 text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? t('submitting') : t('submitReport')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

interface ReportSellerModalProps {
  username: string
}

export function ReportSellerModal({ username }: ReportSellerModalProps) {
  const t = useTranslations('ReportSellerModal')
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2"
      >
        <Flag className="w-4 h-4" />
        {t('report')}
      </Button>

      {open && <ReportSellerDialog username={username} onClose={() => setOpen(false)} />}
    </>
  )
}
