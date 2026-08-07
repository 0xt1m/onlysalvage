import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { Card } from '@/components/ui/Card'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { Link } from '@/i18n/navigation'
import { getCitiesServer } from '@/lib/api-server'
import { slugify } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('CitiesPage')
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/cities' },
  }
}

export default async function CitiesPage() {
  const t = await getTranslations('CitiesPage')
  const cities = await getCitiesServer()

  return (
    <div className="w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 mb-6 gap-3 flex flex-col">
      <BreadcrumbJsonLd items={[{ label: t('breadcrumbHome'), href: '/' }, { label: t('breadcrumbCities') }]} />
      <Card>
        <Breadcrumb items={[{ label: t('breadcrumbHome'), href: '/' }, { label: t('breadcrumbCities') }]} />
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted text-sm">{t('subtitle')}</p>
      </Card>

      <Card>
        {cities.length === 0 ? (
          <p className="text-sm text-muted">{t('noCitiesYet')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {cities.map((city) => (
              <Link
                key={`${city.city}-${city.state}`}
                href={`/cities/${slugify(city.city)}-${city.state.toLowerCase()}`}
                className="p-4 border border-border rounded-lg text-center font-medium text-foreground hover:bg-surface-raised hover:border-primary-light transition-colors"
              >
                {city.city}, {city.state}
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
