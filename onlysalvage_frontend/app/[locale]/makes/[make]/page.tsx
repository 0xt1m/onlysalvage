import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { Card } from '@/components/ui/Card'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { Link } from '@/i18n/navigation'
import { ListingResultsGrid } from '@/components/listings/ListingResultsGrid'
import { getMakesServer, getModelsServer, getListingsServer, getMeServer } from '@/lib/api-server'
import { slugify } from '@/lib/utils'
import type { Make } from '@/lib/types'

export const dynamic = 'force-dynamic'

async function resolveMake(makeSlug: string): Promise<Make | null> {
  const makes = await getMakesServer()
  return makes.find((m) => slugify(m.name) === makeSlug) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ make: string }> }): Promise<Metadata> {
  const { make: makeSlug } = await params
  const make = await resolveMake(makeSlug)
  if (!make) return { title: 'Make not found' }

  const title = `${make.name} for Sale`
  const description = `Browse salvage and rebuilt ${make.name} listings for sale on OnlySalvage. Compare prices, mileage, and title status from verified sellers.`

  return {
    title,
    description,
    alternates: { canonical: `/makes/${makeSlug}` },
    openGraph: { title, description, type: 'website' },
  }
}

export default async function MakePage({ params }: { params: Promise<{ make: string }> }) {
  const { make: makeSlug } = await params
  const t = await getTranslations('MakePage')
  const make = await resolveMake(makeSlug)

  if (!make) notFound()

  const [models, { results: listings, count }, me] = await Promise.all([
    getModelsServer(make.id),
    getListingsServer({ make: make.name, exclude_sold: 'true', ordering: '-created_at', page_size: '24' }),
    getMeServer(),
  ])

  const breadcrumbItems = [
    { label: t('breadcrumbHome'), href: '/' },
    { label: t('breadcrumbMakes'), href: '/makes' },
    { label: make.name },
  ]

  return (
    <div className="w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 mb-6 gap-3 flex flex-col">
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <Card>
        <Breadcrumb items={breadcrumbItems} />
        <h1 className="text-2xl font-semibold">{t('title', { make: make.name })}</h1>
        <p className="text-muted text-sm">{t('subtitle', { count })}</p>

        {models.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {models.map((model) => (
              <Link
                key={model.id}
                href={`/makes/${makeSlug}/${slugify(model.name)}`}
                className="px-3 py-1.5 text-sm rounded-full border border-border text-foreground hover:bg-surface-raised hover:border-primary-light transition-colors"
              >
                {model.name}
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <ListingResultsGrid
          listings={listings}
          variant="v"
          columns={4}
          emptyMessage={t('noListingsYet', { make: make.name })}
          currentUsername={me?.username}
        />
        {count > listings.length && (
          <div className="flex justify-center mt-2">
            <Link
              href={`/inventory?make=${encodeURIComponent(make.name)}`}
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
