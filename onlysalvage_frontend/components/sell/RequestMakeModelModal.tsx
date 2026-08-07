'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { requestMakeModel } from '@/lib/api'

interface RequestMakeModelModalProps {
  kind: 'MAKE' | 'MODEL'
  // Required (and only meaningful) when kind === 'MODEL' -- the make the
  // requested model would be added under.
  makeId?: number
  makeName?: string
  onClose: () => void
}

export function RequestMakeModelModal({ kind, makeId, makeName, onClose }: RequestMakeModelModalProps) {
  const t = useTranslations('RequestMakeModelModal')

  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const close = () => {
    if (submitting) return
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError(t('nameRequired'))
      return
    }

    setSubmitting(true)
    const { ok, data } = await requestMakeModel({
      kind,
      name: name.trim(),
      ...(kind === 'MODEL' && makeId ? { make: makeId } : {}),
    })
    setSubmitting(false)

    if (!ok) {
      const detail = data?.name?.[0] || data?.make?.[0] || data?.detail?.[0]
      setError(detail || t('submitFailed'))
      return
    }

    setSubmitted(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface border border-border rounded-lg w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {kind === 'MAKE' ? t('titleMake') : t('titleModel')}
          </h3>
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
            <p className="text-sm text-muted">
              {kind === 'MAKE' ? t('descriptionMake') : t('descriptionModel', { make: makeName || '' })}
            </p>

            <Input
              label={kind === 'MAKE' ? t('makeNameLabel') : t('modelNameLabel')}
              value={name}
              onChange={(e) => { setName(e.target.value); setError('') }}
              placeholder={kind === 'MAKE' ? t('makeNamePlaceholder') : t('modelNamePlaceholder')}
              error={error}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? t('submitting') : t('submitRequest')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
