'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { changePassword } from '@/lib/api'

export function ChangePasswordForm() {
  const t = useTranslations('ChangePasswordForm')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 8) {
      setError(t('errors.newPasswordTooShort'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('errors.passwordMismatch'))
      return
    }

    setSubmitting(true)
    const result = await changePassword(currentPassword, newPassword)
    setSubmitting(false)

    if (!result.ok) {
      setError(result.data?.detail || t('errors.updateFailed'))
      return
    }

    toast.success(t('updateSucceeded'))
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm">
      <Input
        label={t('currentPassword')}
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
      />
      <Input
        label={t('newPassword')}
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <Input
        label={t('confirmNewPassword')}
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={error}
      />
      <Button type="submit" disabled={submitting} className="self-start">
        {submitting ? t('updating') : t('updatePassword')}
      </Button>
    </form>
  )
}
