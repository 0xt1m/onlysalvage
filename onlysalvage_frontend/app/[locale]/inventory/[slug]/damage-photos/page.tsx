import { Card } from '@/components/ui/Card'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { PhotoGallery } from '@/components/listing/PhotoGallery'
import { getListingServer } from '@/lib/api-server'
import { getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: "Damage Photos",
  robots: { index: false, follow: false },
}

export default async function DamagePhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; locale: string }>
  searchParams: Promise<{ damage_token?: string }>
}) {
  const { slug } = await params
  const { damage_token: damageToken } = await searchParams
  const t = await getTranslations('DamagePhotosPage')

  const listing = await getListingServer(slug, damageToken)

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

  const damageImages = listing.images.filter((img) => img.photo_type === 'before_repair')

  return (
    <div className="w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 mb-6 gap-3 flex flex-col">
      <Card>
        <Breadcrumb
          items={[
            { label: t('breadcrumbHome'), href: '/' },
            { label: t('breadcrumbInventory'), href: '/inventory' },
            { label: listing.title, href: `/inventory/${slug}` },
            { label: t('breadcrumbDamagePhotos') },
          ]}
        />
        <h1 className="text-2xl font-semibold">{t('title', { listingTitle: listing.title })}</h1>
      </Card>

      {damageImages.length > 0 ? (
        <Card className="p-0 overflow-hidden gap-0">
          <PhotoGallery images={damageImages} title={t('galleryTitle', { listingTitle: listing.title })} />
        </Card>
      ) : (
        <Card className="items-center text-center">
          <p className="text-foreground font-medium">{t('noAccessTitle')}</p>
          <p className="text-sm text-muted">
            {listing.has_damage_photos ? t('noAccessDescription') : t('noDamagePhotosDescription')}
          </p>
        </Card>
      )}
    </div>
  )
}
