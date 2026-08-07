'use client'

import { useState } from 'react'
import { Lock, Phone, Mail } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { callSeller } from '@/lib/api'
import { cn, formatPhoneNumber, phoneTelHref } from '@/lib/utils'

interface ContactSellerCardProps {
  listingId: number
  hasPhone: boolean
  // Shown in the masked number before reveal (see ListingSellerSerializer.
  // get_phone_area_code on the backend) -- just the first 3 digits, same
  // "area code only" disclosure described on /support and /guide.
  phoneAreaCode?: string | null
  // Already null unless the seller opted in to showing it publicly (see
  // PublicUserSerializer.get_email on the backend).
  email?: string | null
}

export function ContactSellerCard({ listingId, hasPhone, phoneAreaCode, email }: ContactSellerCardProps) {
  const t = useTranslations('ContactSellerCard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [phone, setPhone] = useState<string | null>(null)

  const handleReveal = async () => {
    setLoading(true)
    setError(false)
    // Fetched through a dedicated endpoint (rather than sitting in the page's
    // initial payload) so this click is what counts as call_count.
    const result = await callSeller(listingId)
    setLoading(false)

    if (!result?.phone) {
      setError(true)
      return
    }
    setPhone(result.phone)
  }

  return (
    // An email is worth printing (someone could copy it down); a Call button
    // that dials via JS isn't -- so the whole card is only worth keeping on
    // paper when there's a public email to show.
    <Card className={cn(!email && 'print:hidden')}>
      <h3 className="text-lg font-semibold">{t('title')}</h3>

      <div className="flex flex-col sm:flex-row gap-2 items-stretch">
        {hasPhone && (
          <div className="flex items-center justify-between gap-3 flex-1 bg-background border border-border rounded-lg pl-3 pr-1.5 py-1.5 print:hidden">
            <span className="flex items-center gap-2 text-sm font-mono text-foreground truncate">
              {phone ? <Phone className="w-4 h-4 text-muted shrink-0" /> : <Lock className="w-4 h-4 text-muted shrink-0" />}
              {phone ? (
                <a href={phoneTelHref(phone)} className="hover:text-primary-light hover:underline truncate">
                  {formatPhoneNumber(phone)}
                </a>
              ) : (
                <span className="text-muted truncate">{t('maskedNumber', { areaCode: phoneAreaCode || '•••' })}</span>
              )}
            </span>
            {!phone && (
              <Button size="sm" onClick={handleReveal} disabled={loading} className="shrink-0">
                {loading ? t('loading') : t('reveal')}
              </Button>
            )}
          </div>
        )}

        {email && (
          <a
            href={`mailto:${email}`}
            className="flex items-center justify-center gap-2 flex-1 px-4 py-2 rounded-md font-medium transition-colors bg-surface border border-border text-foreground hover:bg-surface-raised"
          >
            <Mail className="w-4 h-4" />
            {t('email')}
          </a>
        )}
      </div>

      {error && <p className="text-xs text-error">{t('loadError')}</p>}
    </Card>
  )
}
