import { Card } from '@/components/ui/Card';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd';
import { SellForm } from '@/components/sell/SellForm';
import { Link } from '@/i18n/navigation';
import { Upload } from 'lucide-react';
import { getProfile } from '@/lib/api';
import { getMeServer } from '@/lib/api-server';
import { getTranslations } from 'next-intl/server';

// Forces this route to be rendered dynamically (not statically prerendered),
// so client-side navigations always hit the server/middleware instead of
// being served from Next's client-side static route cache for up to 5 minutes.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Sell Your Car",
  description: "List your car for sale on OnlySalvage in minutes. Enter your VIN, add photos, set a price, and reach buyers for free.",
}

export default async function SellPage() {
  const t = await getTranslations('Sell');

  const me = await getMeServer();
  const profile = me ? await getProfile(me.username) : null;

  return (
    <div className='w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 gap-3 flex flex-col mb-6'>
      <BreadcrumbJsonLd items={[{ label: t('breadcrumbHome'), href: "/" }, { label: t('breadcrumbSell') }]} />
      <Card>
        <Breadcrumb items={[{ label: t('breadcrumbHome'), href: "/" }, { label: t('breadcrumbSell') }]} />
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className='text-2xl font-semibold'>{t('title')}</h1>
            <p className="text-muted">{t('subtitle')}</p>
          </div>
          {profile?.is_dealer && (
            <Link
              href="/sell/bulk"
              className="inline-flex items-center gap-2 text-sm text-primary-light hover:underline shrink-0"
            >
              <Upload className="w-4 h-4" /> {t('bulkUploadLink')}
            </Link>
          )}
        </div>
      </Card>

      <SellForm offersWarranty={profile?.offers_warranty ?? false} />
    </div>
  );
}
