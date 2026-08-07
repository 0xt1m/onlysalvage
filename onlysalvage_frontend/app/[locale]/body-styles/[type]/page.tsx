import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Card } from '@/components/ui/Card'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { Link } from '@/i18n/navigation'
import { ListingResultsGrid } from '@/components/listings/ListingResultsGrid'
import { getListingsServer, getMeServer } from '@/lib/api-server'
import { VEHICLE_TYPES } from '@/lib/types'
import { slugify } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function resolveVehicleType(typeSlug: string) {
  return VEHICLE_TYPES.find((t) => slugify(t.label) === typeSlug) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ type: string }> }): Promise<Metadata> {
  const { type: typeSlug } = await params
  const vehicleType = resolveVehicleType(typeSlug)
  if (!vehicleType) return { title: 'Body style not found' }

  const title = `${vehicleType.label} for Sale`
  const description = `Browse salvage and rebuilt ${vehicleType.label} listings for sale on OnlySalvage. Compare prices, mileage, and title status from verified sellers.`

  return {
    title,
    description,
    alternates: { canonical: `/body-styles/${typeSlug}` },
    openGraph: { title, description, type: 'website' },
  }
}

export default async function BodyStylePage({ params }: { params: Promise<{ type: string }> }) {
  const { type: typeSlug } = await params
  const t = await getTranslations('BodyStylePage')
  const tAttr = await getTranslations('VehicleAttributes')
  const vehicleType = resolveVehicleType(typeSlug)

  if (!vehicleType) notFound()

  const label = tAttr(`vehicleType.${vehicleType.value}`)

  const breadcrumbItems = [
    { label: t('breadcrumbHome'), href: '/' },
    { label: t('breadcrumbBodyStyles'), href: '/body-styles' },
    { label },
  ]

  const [{ results: listings, count }, me] = await Promise.all([
    getListingsServer({
      vehicle_type: vehicleType.label,
      exclude_sold: 'true',
      ordering: '-created_at',
      page_size: '24',
    }),
    getMeServer(),
  ])

  return (
    <div className="w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 mb-6 gap-3 flex flex-col">
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <Card>
        <Breadcrumb items={breadcrumbItems} />
        <h1 className="text-2xl font-semibold">{t('title', { type: label })}</h1>
        <p className="text-muted text-sm">{t('subtitle', { count })}</p>
      </Card>

      <Card>
        <ListingResultsGrid
          listings={listings}
          variant="v"
          columns={4}
          emptyMessage={t('noListingsYet', { type: label })}
          currentUsername={me?.username}
        />
        {count > listings.length && (
          <div className="flex justify-center mt-2">
            <Link
              href={`/inventory?vehicle_type=${encodeURIComponent(vehicleType.label)}`}
              className="text-primary-light hover:text-primary-hover text-sm font-medium"
            >
              {t('viewAllInInventory', { count })}
            </Link>
          </div>
        )}
      </Card>
    </div>
  )
}
