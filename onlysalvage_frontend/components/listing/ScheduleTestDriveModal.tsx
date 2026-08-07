'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Calendar, X, CircleCheckBig } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { scheduleTestDrive } from '@/lib/api'
import { formatPhoneDigits, formatPhoneNumber, isPhoneNumberComplete, phoneDigitsOnly } from '@/lib/utils'

interface ScheduleTestDriveModalProps {
  slug: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function ScheduleTestDriveModal({ slug }: ScheduleTestDriveModalProps) {
  const t = useTranslations('ScheduleTestDrive')

  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [preferredDateTime, setPreferredDateTime] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const close = () => {
    if (submitting) return
    setOpen(false)
    // Reset for next time, but only after the close animation-less unmount --
    // no transition here, so this is safe to do immediately.
    setSubmitted(false)
    setName('')
    setEmail('')
    setPhone('')
    setPreferredDateTime('')
    setMessage('')
    setErrors({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const next: Record<string, string> = {}
    if (!name.trim()) next.name = t('errors.nameRequired')
    if (!email.trim() && !phone.trim()) next.contact = t('errors.contactRequired')
    if (email.trim() && !EMAIL_RE.test(email.trim())) next.email = t('errors.emailInvalid')
    if (phone.trim() && !isPhoneNumberComplete(phone)) next.phone = t('errors.phoneInvalid')
    if (!preferredDateTime) next.preferredDateTime = t('errors.dateRequired')
    else if (new Date(preferredDateTime).getTime() < Date.now()) next.preferredDateTime = t('errors.dateInPast')

    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    const { ok } = await scheduleTestDrive(slug, {
      requester_name: name.trim(),
      requester_email: email.trim() || undefined,
      requester_phone: phone.trim() ? `+1${phoneDigitsOnly(phone)}` : undefined,
      preferred_datetime: new Date(preferredDateTime).toISOString(),
      message: message.trim() || undefined,
    })
    setSubmitting(false)

    if (!ok) {
      setErrors({ submit: t('submitFailed') })
      return
    }

    setSubmitted(true)
  }

  const minDateTime = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className="flex items-center justify-center gap-2 w-full">
        <Calendar className="w-4 h-4" />
        {t('scheduleTestDrive')}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface border border-border rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t('scheduleTestDrive')}</h3>
              <button onClick={close} className="relative group text-muted hover:text-foreground cursor-pointer" aria-label={t('close')}>
                <X className="w-5 h-5" />
                <span className="pointer-events-none absolute right-0 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                  {t('close')}
                </span>
              </button>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center text-center gap-3 py-4">
                <CircleCheckBig className="w-12 h-12 text-success" />
                <p className="text-foreground font-medium">{t('successTitle')}</p>
                <p className="text-sm text-muted">{t('successDescription')}</p>
                <Button variant="secondary" onClick={close} className="mt-2">
                  {t('close')}
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input label={t('nameLabel')} value={name} onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: '' })) }} error={errors.name} />
                <Input
                  label={t('emailLabel')}
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '', contact: '' })) }}
                  error={errors.email}
                  placeholder={t('emailPlaceholder')}
                />
                <Input
                  label={t('phoneLabel')}
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    const input = e.target
                    const formatted = formatPhoneNumber(input.value)
                    setPhone(formatted)
                    setErrors((p) => ({ ...p, phone: '', contact: '' }))
                    requestAnimationFrame(() => input.setSelectionRange(formatted.length, formatted.length))
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'Backspace') return
                    e.preventDefault()
                    const input = e.currentTarget
                    const digits = phoneDigitsOnly(phone)
                    const formatted = formatPhoneDigits(digits.slice(0, -1))
                    setPhone(formatted)
                    setErrors((p) => ({ ...p, phone: '', contact: '' }))
                    requestAnimationFrame(() => input.setSelectionRange(formatted.length, formatted.length))
                  }}
                  placeholder={t('phonePlaceholder')}
                  error={errors.phone}
                />
                {errors.contact && <p className="text-xs text-error -mt-2">{errors.contact}</p>}

                <Input
                  label={t('preferredDateTimeLabel')}
                  type="datetime-local"
                  value={preferredDateTime}
                  onChange={(e) => { setPreferredDateTime(e.target.value); setErrors((p) => ({ ...p, preferredDateTime: '' })) }}
                  min={minDateTime}
                  error={errors.preferredDateTime}
                  className="[color-scheme:light] dark:[color-scheme:dark]"
                />

                <div className="flex flex-col gap-1">
                  <label className="text-sm text-foreground">{t('messageLabel')}</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={3}
                    placeholder={t('messagePlaceholder')}
                    className="bg-surface border border-border rounded-md px-3 py-2 text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary resize-none"
                  />
                </div>

                {errors.submit && <p className="text-sm text-error">{errors.submit}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
                    {t('cancel')}
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? t('submitting') : t('submit')}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
