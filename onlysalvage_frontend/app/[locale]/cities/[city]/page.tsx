import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Card } from '@/components/ui/Card'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { Link } from '@/i18n/navigation'
import { ListingResultsGrid } from '@/components/listings/ListingResultsGrid'
import { getCitiesServer, getListingsServer, getMeServer } from '@/lib/api-server'
import { slugify } from '@/lib/utils'
import type { CityListing } from '@/lib/types'

export const dynamic = 'force-dynamic'

async function resolveCity(citySlug: string): Promise<CityListing | null> {
  const cities = await getCitiesServer()
  return cities.find((c) => `${slugify(c.city)}-${c.state.toLowerCase()}` === citySlug) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city: citySlug } = await params
  const city = await resolveCity(citySlug)
  if (!city) return { title: 'City not found' }

  const title = `Rebuilt & Salvage Cars for Sale in ${city.city}, ${city.state}`
  const description = `Browse salvage and rebuilt vehicle listings for sale in ${city.city}, ${city.state} on OnlySalvage. Compare prices, mileage, and title status from verified sellers.`

  return {
    title,
    description,
    alternates: { canonical: `/cities/${citySlug}` },
    openGraph: { title, description, type: 'website' },
  }
}

export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city: citySlug } = await params
  const t = await getTranslations('CityPage')
  const city = await resolveCity(citySlug)

  if (!city) notFound()

  const breadcrumbItems = [
    { label: t('breadcrumbHome'), href: '/' },
    { label: t('breadcrumbCities'), href: '/cities' },
    { label: `${city.city}, ${city.state}` },
  ]

  const [{ results: listings, count }, me] = await Promise.all([
    getListingsServer({
      city: city.city,
      state: city.state,
      exclude_sold: 'true',
      ordering: '-created_at',
      page_size: '60',
    }),
    getMeServer(),
  ])

  return (
    <div className="w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 mb-6 gap-3 flex flex-col">
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <Card>
        <Breadcrumb items={breadcrumbItems} />
        <h1 className="text-2xl font-semibold">{t('title', { city: city.city, state: city.state })}</h1>
        <p className="text-muted text-sm">{t('subtitle', { count })}</p>
      </Card>

      <Card>
        <ListingResultsGrid
          listings={listings}
          variant="v"
          columns={4}
          emptyMessage={t('noListingsYet', { city: city.city })}
          currentUsername={me?.username}
        />
        {count > listings.length && (
          <div className="flex justify-center mt-2">
            <Link
              href="/inventory"
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
