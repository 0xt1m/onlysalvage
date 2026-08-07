'use client'

import { Printer } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/Button'

export function PrintListingButton() {
  const t = useTranslations('ListingDetail')

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => window.print()}
      className="w-full flex items-center justify-center gap-2 print:hidden"
    >
      <Printer className="w-4 h-4" />
      {t('printListing')}
    </Button>
  )
}
