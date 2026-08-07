'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useRouter } from '@/i18n/navigation'
import { updateProfile } from '@/lib/api'
import { US_STATES } from '@/lib/types'

export function CompleteProfileForm() {
  const t = useTranslations('CompleteProfile')
  const router = useRouter()

  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const validate = () => {
    const next: Record<string, string> = {}
    if (!city.trim()) next.city = t('errors.cityRequired')
    if (!state) next.state = t('errors.stateRequired')
    if (!/^\d{5}$/.test(zipCode.trim())) next.zip_code = t('errors.zipInvalid')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    const data = new FormData()
    data.append('city', city.trim())
    data.append('state', state)
    data.append('zip_code', zipCode.trim())

    const result = await updateProfile(data)
    setSubmitting(false)

    if (!result) {
      setErrors(prev => ({ ...prev, detail: t('errors.updateFailed') }))
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <Card className="gap-4">
        <div>
          <h1 className="text-primary-light text-lg font-bold">{t('title')}</h1>
          <p className="text-sm text-muted mt-1">{t('description')}</p>
        </div>

        <Input label={t('city')} value={city} onChange={(e) => setCity(e.target.value)} error={errors.city} />
        <Select label={t('state')} value={state} onChange={(e) => setState(e.target.value)} options={US_STATES} placeholder={t('select')} error={errors.state} />
        <Input label={t('zipCode')} value={zipCode} onChange={(e) => setZipCode(e.target.value)} error={errors.zip_code} />

        {errors.detail && <p className="text-accent text-sm">{errors.detail}</p>}

        <Button variant="primary" type="submit" disabled={submitting}>
          {submitting ? t('saving') : t('submit')}
        </Button>
      </Card>
    </form>
  )
}
