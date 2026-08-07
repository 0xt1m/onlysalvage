'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { submitContactMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'

export function ContactForm() {
  const t = useTranslations('ContactForm')
  const { user } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<{ email?: string; message?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const nextErrors: typeof errors = {}
    if (!user && !email.trim()) nextErrors.email = t('emailRequired')
    if (!message.trim()) nextErrors.message = t('messageRequired')
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    const { ok, data } = await submitContactMessage({
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
    })
    setSubmitting(false)

    if (!ok) {
      toast.error(data?.email?.[0] || data?.message?.[0] || t('submitFailed'))
      return
    }

    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center text-center gap-2 py-4">
        <CheckCircle2 className="w-8 h-8 text-success" />
        <p className="text-sm font-medium text-foreground">{t('submitSucceeded')}</p>
        <Button variant="secondary" size="sm" onClick={() => { setSubmitted(false); setName(''); setEmail(''); setMessage('') }}>
          {t('submitAnother')}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {!user && (
        <>
          <Input
            label={t('nameLabel')}
            placeholder={t('namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label={t('emailLabel')}
            placeholder={t('emailPlaceholder')}
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })) }}
            error={errors.email}
          />
        </>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm text-foreground">{t('messageLabel')}</label>
        <textarea
          value={message}
          onChange={(e) => { setMessage(e.target.value); setErrors(p => ({ ...p, message: undefined })) }}
          rows={4}
          placeholder={t('messagePlaceholder')}
          className="bg-surface border border-border rounded-md px-3 py-2 text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary resize-none"
        />
        {errors.message && <span className="text-xs text-error">{errors.message}</span>}
      </div>

      <Button type="submit" size="sm" disabled={submitting} className="flex items-center justify-center gap-2">
        <Send className="w-4 h-4" />
        {submitting ? t('submitting') : t('submit')}
      </Button>
    </form>
  )
}
