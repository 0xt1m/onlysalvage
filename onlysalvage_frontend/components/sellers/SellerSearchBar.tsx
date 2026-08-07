'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface SellerSearchBarProps {
  initialQuery?: string
}

export function SellerSearchBar({ initialQuery = '' }: SellerSearchBarProps) {
  const t = useTranslations('SellerSearchBar')
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    router.push(trimmed ? `/sellers?search=${encodeURIComponent(trimmed)}` : '/sellers')
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 mt-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('searchPlaceholder')}
        className="rounded-full"
      />
      <Button type="submit" className="rounded-full">{t('search')}</Button>
    </form>
  )
}
