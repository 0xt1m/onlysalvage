import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd';
import { BulkUploadForm } from '@/components/sell/BulkUploadForm';
import { getProfile } from '@/lib/api';
import { getMeServer } from '@/lib/api-server';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Bulk Upload Listings",
  description: "Dealers can add multiple vehicles at once by uploading a CSV file.",
}

export default async function SellBulkPage() {
  const t = await getTranslations('SellBulk');

  const me: { username: string } | null = await getMeServer();
  if (!me) redirect('/login');

  const profile = await getProfile(me.username);
  if (!profile?.is_dealer) redirect('/sell');

  return (
    <div className='w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 gap-3 flex flex-col mb-6'>
      <BreadcrumbJsonLd items={[
        { label: t('breadcrumbHome'), href: "/" },
        { label: t('breadcrumbSell'), href: "/sell" },
        { label: t('breadcrumbBulk') },
      ]} />
      <Card>
        <Breadcrumb items={[
          { label: t('breadcrumbHome'), href: "/" },
          { label: t('breadcrumbSell'), href: "/sell" },
          { label: t('breadcrumbBulk') },
        ]} />
        <h1 className='text-2xl font-semibold'>{t('title')}</h1>
        <p className="text-muted">{t('subtitle')}</p>
      </Card>

      <BulkUploadForm />
    </div>
  );
}
