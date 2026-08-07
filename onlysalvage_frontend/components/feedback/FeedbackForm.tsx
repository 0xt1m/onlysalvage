'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Send } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { submitFeedback } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'
import { FEEDBACK_CATEGORIES } from '@/lib/types'
import { translateOptions } from '@/lib/utils'

export function FeedbackForm() {
  const t = useTranslations('Feedback')
  const tCategory = useTranslations('FeedbackCategories')
  const { user } = useAuth()

  const [category, setCategory] = useState('SUG')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [context, setContext] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<{ subject?: string; message?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const nextErrors: typeof errors = {}
    if (!subject.trim()) nextErrors.subject = t('subjectRequired')
    if (!message.trim()) nextErrors.message = t('messageRequired')
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    const { ok, data } = await submitFeedback({
      category,
      subject: subject.trim(),
      message: message.trim(),
      context: context.trim(),
      ...(!user && email.trim() && { email: email.trim() }),
    })
    setSubmitting(false)

    if (!ok) {
      toast.error(data?.subject?.[0] || data?.message?.[0] || t('submitFailed'))
      return
    }

    setSubmitted(true)
  }

  const handleReset = () => {
    setCategory('SUG')
    setSubject('')
    setMessage('')
    setContext('')
    setEmail('')
    setErrors({})
    setSubmitted(false)
  }

  if (submitted) {
    return (
      <Card className="items-center text-center gap-3 py-10 max-w-2xl">
        <CheckCircle2 className="w-10 h-10 text-success" />
        <h2 className="text-lg font-semibold">{t('submitSucceededTitle')}</h2>
        <p className="text-sm text-muted max-w-md">{t('submitSucceededDescription')}</p>
        <Button variant="secondary" size="sm" onClick={handleReset} className="mt-2">
          {t('submitAnother')}
        </Button>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          label={t('categoryLabel')}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={translateOptions(FEEDBACK_CATEGORIES, (code) => tCategory(code))}
        />

        <Input
          label={t('subjectLabel')}
          placeholder={t('subjectPlaceholder')}
          value={subject}
          onChange={(e) => { setSubject(e.target.value); setErrors(p => ({ ...p, subject: undefined })) }}
          error={errors.subject}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm text-foreground">{t('messageLabel')}</label>
          <textarea
            value={message}
            onChange={(e) => { setMessage(e.target.value); setErrors(p => ({ ...p, message: undefined })) }}
            rows={6}
            placeholder={t('messagePlaceholder')}
            className="bg-surface border border-border rounded-md px-3 py-2 text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary resize-none"
          />
          {errors.message && <span className="text-xs text-error">{errors.message}</span>}
        </div>

        <Input
          label={t('contextLabel')}
          placeholder={t('contextPlaceholder')}
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />

        {!user && (
          <Input
            label={t('emailLabel')}
            placeholder={t('emailPlaceholder')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        )}

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={submitting} className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
