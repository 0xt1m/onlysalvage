'use client'

import { useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DeleteListingDialog } from '@/components/listing/DeleteListingModal'

interface DeleteListingButtonProps {
  slug: string
  // Deleting removes the page this button lives on -- lands the owner back
  // on their own profile (where the listing used to be listed) instead of
  // leaving them on a now-404ing detail page.
  sellerUsername: string
}

export function DeleteListingButton({ slug, sellerUsername }: DeleteListingButtonProps) {
  const router = useRouter()
  const t = useTranslations('ListingCard')
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setDeleting(true)}
        className="w-full flex items-center justify-center gap-2 text-error hover:text-error"
      >
        <Trash2 className="w-4 h-4" />
        {t('deleteListing')}
      </Button>
      {deleting && (
        <DeleteListingDialog
          slug={slug}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            setDeleting(false)
            router.push(`/profile/${sellerUsername}`)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
