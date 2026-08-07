'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Clock3, Copy, KeyRound, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { requestApiKey, generateApiKey, revokeApiKey } from '@/lib/api'
import type { ApiKeyStatus } from '@/lib/types'

interface ApiKeySectionProps {
  initialStatus: ApiKeyStatus | null
  isVerified: boolean
}

export function ApiKeySection({ initialStatus, isVerified }: ApiKeySectionProps) {
  const t = useTranslations('ApiAccess')

  const [data, setData] = useState<ApiKeyStatus | null>(initialStatus)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [freshToken, setFreshToken] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<'regenerate' | 'revoke' | null>(null)

  const status = data?.status ?? 'none'

  const handleRequest = async () => {
    setSubmitting(true)
    const { ok, data: result } = await requestApiKey(note)
    setSubmitting(false)

    if (!ok || !result || !('status' in result)) {
      const message = (result && 'detail' in result && result.detail) || t('requestFailed')
      toast.error(message)
      return
    }

    setData(result)
    toast.success(result.status === 'AP' ? t('requestApprovedInstantly') : t('requestSucceeded'))
  }

  const handleGenerate = async () => {
    setSubmitting(true)
    const { ok, data: result } = await generateApiKey()
    setSubmitting(false)

    if (!ok || !result || !('token' in result)) {
      const message = (result && 'detail' in result && result.detail) || t('generateFailed')
      toast.error(message)
      return
    }

    setFreshToken(result.token)
    setData(prev => prev ? { ...prev, has_token: true, key_prefix: result.key_prefix, issued_at: result.issued_at } : prev)
    setConfirmAction(null)
    toast.success(t('generateSucceeded'))
  }

  const handleRevoke = async () => {
    setSubmitting(true)
    const { ok, data: result } = await revokeApiKey()
    setSubmitting(false)

    if (!ok || !result || !('status' in result)) {
      toast.error(t('revokeFailed'))
      return
    }

    setData(result)
    setFreshToken(null)
    setConfirmAction(null)
    toast.success(t('revokeSucceeded'))
  }

  const handleCopy = async () => {
    if (!freshToken) return
    try {
      await navigator.clipboard.writeText(freshToken)
      toast.success(t('tokenCopied'))
    } catch {
      toast.error(t('tokenCopyFailed'))
    }
  }

  return (
    <Card id="api" className="scroll-mt-26">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <Link href="/developers" className="text-sm text-primary-light hover:underline">
          {t('viewDocs')}
        </Link>
      </div>
      <p className="text-sm text-muted">{t('description')}</p>

      {status === 'none' && (
        <div className="flex flex-col gap-3">
          <Input
            label={t('noteLabel')}
            placeholder={t('notePlaceholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {isVerified && <p className="text-xs text-success">{t('verifiedHint')}</p>}
          <Button
            variant="secondary"
            size="sm"
            className="flex items-center gap-2 w-fit"
            onClick={handleRequest}
            disabled={submitting}
          >
            <KeyRound className="w-4 h-4" />
            {submitting ? t('submitting') : t('requestAccess')}
          </Button>
        </div>
      )}

      {status === 'PE' && (
        <span className="flex items-center gap-1.5 text-sm text-muted">
          <Clock3 className="w-4 h-4" />
          {t('pendingReview')}
        </span>
      )}

      {status === 'DE' && (
        <div className="flex flex-col gap-2 items-start">
          <span className="flex items-center gap-1.5 text-sm text-error">
            <XCircle className="w-4 h-4" />
            {t('denied')}
          </span>
          {data?.denial_reason && <p className="text-xs text-muted">{data.denial_reason}</p>}
          <Button variant="secondary" size="sm" onClick={handleRequest} disabled={submitting}>
            {submitting ? t('submitting') : t('requestAgain')}
          </Button>
        </div>
      )}

      {status === 'RE' && (
        <div className="flex flex-col gap-2 items-start">
          <span className="text-sm text-muted">{t('revoked')}</span>
          <Button variant="secondary" size="sm" onClick={handleRequest} disabled={submitting}>
            {submitting ? t('submitting') : t('requestAgain')}
          </Button>
        </div>
      )}

      {status === 'AP' && !data?.has_token && !freshToken && (
        <div className="flex flex-col gap-2 items-start">
          <span className="flex items-center gap-1.5 text-sm text-success">
            <ShieldCheck className="w-4 h-4" />
            {t('approved')}
          </span>
          <Button
            variant="primary"
            size="sm"
            className="flex items-center gap-2"
            onClick={handleGenerate}
            disabled={submitting}
          >
            <KeyRound className="w-4 h-4" />
            {submitting ? t('submitting') : t('generateToken')}
          </Button>
        </div>
      )}

      {status === 'AP' && (data?.has_token || freshToken) && (
        <div className="flex flex-col gap-3">
          {freshToken ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-warning">{t('tokenShownOnce')}</p>
              <div className="flex items-center gap-2 bg-background border border-border rounded-md p-2">
                <code className="text-xs text-foreground break-all flex-1">{freshToken}</code>
                <Button variant="ghost" size="sm" onClick={handleCopy} className="shrink-0 flex items-center gap-1">
                  <Copy className="w-3.5 h-3.5" />
                  {t('copy')}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground font-mono">{data?.key_prefix}…</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => setConfirmAction('regenerate')}
              disabled={submitting}
            >
              <RefreshCw className="w-4 h-4" />
              {t('regenerate')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-error border-error hover:bg-error/10"
              onClick={() => setConfirmAction('revoke')}
              disabled={submitting}
            >
              {t('revoke')}
            </Button>
          </div>

          {data?.last_used_at && (
            <p className="text-xs text-muted">{t('lastUsed', { date: new Date(data.last_used_at).toLocaleString() })}</p>
          )}
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface border border-border rounded-lg w-full max-w-md p-6 flex flex-col gap-4">
            <h3 className="text-lg font-semibold">
              {confirmAction === 'regenerate' ? t('confirmRegenerateTitle') : t('confirmRevokeTitle')}
            </h3>
            <p className="text-sm text-muted">
              {confirmAction === 'regenerate' ? t('confirmRegenerateDescription') : t('confirmRevokeDescription')}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setConfirmAction(null)} disabled={submitting}>
                {t('cancel')}
              </Button>
              <Button
                type="button"
                onClick={confirmAction === 'regenerate' ? handleGenerate : handleRevoke}
                disabled={submitting}
                className="bg-error hover:bg-error text-white"
              >
                {submitting ? t('submitting') : confirmAction === 'regenerate' ? t('regenerate') : t('revoke')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
