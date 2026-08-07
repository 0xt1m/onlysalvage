'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Clock3, BadgeCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { requestVerification } from '@/lib/api'

type VerificationStatus = 'verified' | 'pending' | 'rejected' | 'none'

interface RequestVerificationButtonProps {
  initialStatus: VerificationStatus
}

export function RequestVerificationButton({ initialStatus }: RequestVerificationButtonProps) {
  const t = useTranslations('RequestVerification')
  const [status, setStatus] = useState(initialStatus)
  const [submitting, setSubmitting] = useState(false)

  // The name badge next to the seller's display name already covers this case.
  if (status === 'verified') return null

  if (status === 'pending') {
    return (
      <span className="flex items-center gap-1.5 text-sm text-muted">
        <Clock3 className="w-4 h-4" />
        {t('pending')}
      </span>
    )
  }

  const handleRequest = async () => {
    setSubmitting(true)
    const result = await requestVerification()
    setSubmitting(false)

    if (!result?.ok) {
      toast.error(result?.data?.detail || t('requestFailed'))
      return
    }

    setStatus('pending')
    toast.success(t('requestSucceeded'))
  }

  return (
    <div className="flex flex-col gap-1 items-end">
      {status === 'rejected' && <span className="text-xs text-muted">{t('previouslyDeclined')}</span>}
      <Button
        variant="secondary"
        size="sm"
        className="flex items-center gap-2"
        onClick={handleRequest}
        disabled={submitting}
      >
        <BadgeCheck className="w-4 h-4" />
        {submitting ? t('submitting') : t('requestVerification')}
      </Button>
    </div>
  )
}
