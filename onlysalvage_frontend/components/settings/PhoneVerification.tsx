'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { sendPhoneVerificationCode, checkPhoneVerificationCode } from '@/lib/api'
import { isPhoneNumberComplete } from '@/lib/utils'

interface UsePhoneVerificationArgs {
  // The live, possibly-unsaved value of the phone input this is attached to.
  liveInputPhone: string
  // The phone number + verified state actually on the account when the page
  // loaded -- just the seed for the very first render, not read again after.
  initialPhone: string
  initialVerified: boolean
}

// A plain, always-editable phone field: typing anything different from the
// last-verified value immediately counts as unverified again (no separate
// "change number" flow needed -- editing the field *is* how you change it),
// and verifying sends the code straight to whatever's currently typed. The
// caller is responsible for blocking its own submit while `verified` is
// false and the field doesn't match what's on file.
export function usePhoneVerification({ liveInputPhone, initialPhone, initialVerified }: UsePhoneVerificationArgs) {
  const t = useTranslations('PhoneVerification')

  // Which exact phone value the last successful code check actually
  // covered -- comparing this to the live input is what makes "change one
  // digit -> immediately unverified" just fall out of a string comparison,
  // rather than needing its own tracked boolean that could drift.
  const [verifiedFor, setVerifiedFor] = useState<string | null>(initialVerified ? initialPhone : null)
  const [sending, setSending] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [sentFor, setSentFor] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)

  const verified = verifiedFor === liveInputPhone

  // A pending code was for whatever the field held at send time -- if it's
  // been edited since, that code no longer applies to anything.
  useEffect(() => {
    if (codeSent && sentFor !== liveInputPhone) {
      setCodeSent(false)
      setCode('')
    }
  }, [liveInputPhone, codeSent, sentFor])

  const handleSend = async () => {
    setSending(true)
    const ok = await sendPhoneVerificationCode(liveInputPhone)
    setSending(false)

    if (!ok) {
      toast.error(t('sendFailed'))
      return
    }
    setSentFor(liveInputPhone)
    setCodeSent(true)
    toast.success(t('codeSent'))
  }

  const handleCheck = async () => {
    if (!code.trim()) return
    setChecking(true)
    const ok = await checkPhoneVerificationCode(liveInputPhone, code.trim())
    setChecking(false)

    if (!ok) {
      toast.error(t('invalidCode'))
      return
    }
    setVerifiedFor(liveInputPhone)
    setCodeSent(false)
    setCode('')
    toast.success(t('verifySucceeded'))
  }

  // Rendered by Input as a bordered segment attached to its own right edge
  // (see endButton there) -- reads as one control: phone field on the left,
  // "Verify" button on the right, appearing the moment the field no longer
  // matches whatever was last actually verified.
  const verifyButton = !verified && !codeSent && isPhoneNumberComplete(liveInputPhone) ? {
    label: sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('verify'),
    onClick: handleSend,
    disabled: sending,
  } : undefined

  const panel = !verified && codeSent ? (
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
  ) : null

  return { verifyButton, panel, verified }
}
