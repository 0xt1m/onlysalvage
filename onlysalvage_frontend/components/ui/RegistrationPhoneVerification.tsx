'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { BadgeCheck, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { sendRegistrationPhoneCode, checkRegistrationPhoneCode } from '@/lib/api'
import { isPhoneNumberComplete } from '@/lib/utils'

interface UseRegistrationPhoneVerificationArgs {
  phone: string
  verified: boolean
  onVerifiedChange: (verified: boolean) => void
}

// Same shape as usePhoneVerification in settings: `verifyButton` is meant
// for the phone Input's own endButton prop (an attached, bordered "Verify"
// segment), `panel` is the code-entry/verified-badge UI that needs its own
// room below the input.
export function useRegistrationPhoneVerification({ phone, verified, onVerifiedChange }: UseRegistrationPhoneVerificationArgs) {
  const t = useTranslations('PhoneVerification')
  const [sending, setSending] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  // Which phone value the last successful send/verify actually applies to --
  // editing the number afterward should require starting over rather than
  // silently keep counting as verified for a number that was never checked.
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null)

  useEffect(() => {
    if (verified && confirmedFor !== phone) {
      onVerifiedChange(false)
      setCodeSent(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone])

  const handleSend = async () => {
    setSending(true)
    const ok = await sendRegistrationPhoneCode(phone)
    setSending(false)

    if (!ok) {
      toast.error(t('sendFailed'))
      return
    }
    setCodeSent(true)
    setConfirmedFor(phone)
    toast.success(t('codeSent'))
  }

  const handleCheck = async () => {
    if (!code.trim()) return
    setChecking(true)
    const ok = await checkRegistrationPhoneCode(phone, code.trim())
    setChecking(false)

    if (!ok) {
      toast.error(t('invalidCode'))
      return
    }
    onVerifiedChange(true)
    setCodeSent(false)
    setCode('')
    toast.success(t('verifySucceeded'))
  }

  const canVerify = !verified && isPhoneNumberComplete(phone)

  const verifyButton = canVerify && !codeSent ? {
    label: sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('verify'),
    onClick: handleSend,
    disabled: sending,
  } : undefined

  let panel: React.ReactNode = null

  if (verified) {
    panel = (
      <span className="flex items-center gap-1.5 text-sm text-success">
        <BadgeCheck className="w-4 h-4" />
        {t('verified')}
      </span>
    )
  } else if (canVerify && codeSent) {
    panel = (
      <div className="flex items-end gap-2 flex-wrap">
        <Input
          label={t('codeLabel')}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={t('codePlaceholder')}
        />
        <Button type="button" size="sm" onClick={handleCheck} disabled={checking || !code.trim()}>
          {checking ? t('verifying') : t('confirmCode')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={handleSend} disabled={sending}>
          {t('resendCode')}
        </Button>
      </div>
    )
  }

  return { verifyButton, panel }
}
