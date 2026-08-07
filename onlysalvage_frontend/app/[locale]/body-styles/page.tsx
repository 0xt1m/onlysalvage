import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { Card } from '@/components/ui/Card'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { Link } from '@/i18n/navigation'
import { VEHICLE_TYPES } from '@/lib/types'
import { slugify } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('BodyStylesPage')
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/body-styles' },
  }
}

export default async function BodyStylesPage() {
  const t = await getTranslations('BodyStylesPage')
  const tAttr = await getTranslations('VehicleAttributes')

  return (
    <div className="w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 mb-6 gap-3 flex flex-col">
      <BreadcrumbJsonLd items={[{ label: t('breadcrumbHome'), href: '/' }, { label: t('breadcrumbBodyStyles') }]} />
      <Card>
        <Breadcrumb items={[{ label: t('breadcrumbHome'), href: '/' }, { label: t('breadcrumbBodyStyles') }]} />
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted text-sm">{t('subtitle')}</p>
      </Card>

      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {VEHICLE_TYPES.map((type) => (
            <Link
              key={type.value}
              href={`/body-styles/${slugify(type.label)}`}
              className="p-4 border border-border rounded-lg text-center font-medium text-foreground hover:bg-surface-raised hover:border-primary-light transition-colors"
            >
              {tAttr(`vehicleType.${type.value}`)}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
