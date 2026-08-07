import { redirect } from '@/i18n/navigation'
import { Card } from '@/components/ui/Card'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { getMeServer, getListingServer } from '@/lib/api-server'
import { EditListingForm } from '@/components/listing/EditListingForm'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: "Edit Listing",
}

export default async function EditListingPage({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale } = await params
  const t = await getTranslations('EditListingPage')

  const [listing, me] = await Promise.all([
    getListingServer(slug),
    getMeServer(),
  ])

  if (!listing) {
    return (
      <div className="w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 gap-3 flex flex-col">
        <Card className="items-center">
          <h1 className="text-2xl">{t('listingNotFoundTitle')}</h1>
          <p className="text-muted">{t('listingNotFoundDescription', { slug })}</p>
        </Card>
      </div>
    )
  }

  if (!me || me.username !== listing.seller.username) {
    redirect({ href: `/inventory/${slug}`, locale })
  }

  return (
    <div className="w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 mb-6 gap-3 flex flex-col">
      <Card>
        <Breadcrumb
          items={[
            { label: t('breadcrumbHome'), href: '/' },
            { label: t('breadcrumbInventory'), href: '/inventory' },
            { label: listing.title, href: `/inventory/${slug}` },
            { label: t('breadcrumbEdit') },
          ]}
        />
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
      </Card>

      <EditListingForm listing={listing} />
    </div>
  )
}
