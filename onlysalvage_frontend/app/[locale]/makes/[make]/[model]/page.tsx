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
import type { Make, VehicleModel } from '@/lib/types'

export const dynamic = 'force-dynamic'

async function resolveMakeAndModel(
  makeSlug: string,
  modelSlug: string
): Promise<{ make: Make; model: VehicleModel } | null> {
  const makes = await getMakesServer()
  const make = makes.find((m) => slugify(m.name) === makeSlug)
  if (!make) return null

  const models = await getModelsServer(make.id)
  const model = models.find((m) => slugify(m.name) === modelSlug)
  if (!model) return null

  return { make, model }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ make: string; model: string }>
}): Promise<Metadata> {
  const { make: makeSlug, model: modelSlug } = await params
  const resolved = await resolveMakeAndModel(makeSlug, modelSlug)
  if (!resolved) return { title: 'Model not found' }

  const { make, model } = resolved
  const title = `${make.name} ${model.name} for Sale`
  const description = `Browse salvage and rebuilt ${make.name} ${model.name} listings for sale on OnlySalvage. Compare prices, mileage, and title status from verified sellers.`

  return {
    title,
    description,
    alternates: { canonical: `/makes/${makeSlug}/${modelSlug}` },
    openGraph: { title, description, type: 'website' },
  }
}

export default async function MakeModelPage({
  params,
}: {
  params: Promise<{ make: string; model: string }>
}) {
  const { make: makeSlug, model: modelSlug } = await params
  const t = await getTranslations('MakeModelPage')
  const resolved = await resolveMakeAndModel(makeSlug, modelSlug)

  if (!resolved) notFound()
  const { make, model } = resolved

  const [{ results: listings, count }, me] = await Promise.all([
    getListingsServer({
      make: make.name,
      model: model.name,
      exclude_sold: 'true',
      ordering: '-created_at',
      page_size: '24',
    }),
    getMeServer(),
  ])

  const breadcrumbItems = [
    { label: t('breadcrumbHome'), href: '/' },
    { label: t('breadcrumbMakes'), href: '/makes' },
    { label: make.name, href: `/makes/${makeSlug}` },
    { label: model.name },
  ]

  return (
    <div className="w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 mb-6 gap-3 flex flex-col">
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <Card>
        <Breadcrumb items={breadcrumbItems} />
        <h1 className="text-2xl font-semibold">{t('title', { make: make.name, model: model.name })}</h1>
        <p className="text-muted text-sm">{t('subtitle', { count })}</p>
      </Card>

      <Card>
        <ListingResultsGrid
          listings={listings}
          variant="v"
          columns={4}
          emptyMessage={t('noListingsYet', { make: make.name, model: model.name })}
          currentUsername={me?.username}
        />
        {count > listings.length && (
          <div className="flex justify-center mt-2">
            {/* InventoryBrowser only has a make filter wired up today, so
                this intentionally drops ?model= rather than link to a page
                that would silently ignore it. */}
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
