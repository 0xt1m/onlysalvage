import { Card } from '@/components/ui/Card'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { SellerCard } from '@/components/sellers/SellerCard'
import { SellerSearchBar } from '@/components/sellers/SellerSearchBar'
import { getSellersServer, getMeServer } from '@/lib/api-server'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sellers',
  description: 'Browse rated private sellers and dealers on OnlySalvage. Check reviews and ratings before you buy.',
}

export default async function SellersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const { search } = await searchParams
  const [{ results: sellers }, me] = await Promise.all([
    getSellersServer(search ? { search } : {}),
    getMeServer(),
  ])
  const t = await getTranslations('Sellers')

  return (
    <div className="w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 mb-6 gap-3 flex flex-col">
      <BreadcrumbJsonLd items={[{ label: t('breadcrumbHome'), href: '/' }, { label: t('breadcrumbSellers') }]} />
      <Card>
        <Breadcrumb items={[{ label: t('breadcrumbHome'), href: '/' }, { label: t('breadcrumbSellers') }]} />
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted text-sm">{t('subtitle')}</p>
        <SellerSearchBar initialQuery={search ?? ''} />
      </Card>

      <Card>
        {sellers.length === 0 ? (
          <p className="text-sm text-muted">
            {search ? t('noSellersMatch', { search }) : t('noSellersYet')}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sellers.map((seller) => (
              <SellerCard key={seller.id} {...seller} currentUsername={me?.username} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
