'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth-context'
import { deleteAccount } from '@/lib/api'

export function DeleteAccountButton() {
  const t = useTranslations('DeleteAccountButton')
  const router = useRouter()
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleDelete = async () => {
    setSubmitting(true)
    const ok = await deleteAccount()
    setSubmitting(false)

    if (!ok) {
      toast.error(t('deleteFailed'))
      return
    }

    await logout()
    toast.success(t('deleteSucceeded'))
    router.push('/')
    // See Navbar's logout handler for why this is needed -- otherwise a
    // Router-Cache-stale home page can still render as if this (now
    // deleted) account were logged in.
    router.refresh()
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setOpen(true)}
        className="text-error border-error hover:bg-error/10"
      >
        {t('deleteAccount')}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface border border-border rounded-lg w-full max-w-md p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t('confirmTitle')}</h3>
              <button
                onClick={() => setOpen(false)}
                className="relative group text-muted hover:text-foreground cursor-pointer"
                aria-label={t('close')}
              >
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
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={submitting}>
                {t('cancel')}
              </Button>
              <Button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="bg-error hover:bg-error text-white"
              >
                {submitting ? t('deleting') : t('deleteMyAccount')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
