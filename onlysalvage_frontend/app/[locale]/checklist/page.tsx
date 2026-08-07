import { Card } from '@/components/ui/Card';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd';
import { BuyerChecklistContent } from '@/components/checklist/BuyerChecklistContent';
import { AboutRebuiltTitles } from '@/components/checklist/AboutRebuiltTitles';
import { getBuyerChecklistServer } from '@/lib/api-server';
import { getTranslations, getLocale } from 'next-intl/server';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Buyer's Checklist",
  description: "Everything to check before buying a salvage vehicle -- title status, vehicle history, inspection, paperwork, insurance, and registration.",
};

export default async function ChecklistPage() {
  const t = await getTranslations('Checklist');
  const locale = await getLocale();
  const categories = await getBuyerChecklistServer(locale);

  return (
    <div className="w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 mb-6 gap-3 flex flex-col print:px-0 print:mt-0 print:mb-0 print:gap-1">
      <BreadcrumbJsonLd items={[{ label: t('breadcrumbHome'), href: '/' }, { label: t('breadcrumbChecklist') }]} />
      <Card className="print:p-2 print:gap-1 print:border-none print:mb-2">
        <div className="print:hidden">
          <Breadcrumb items={[{ label: t('breadcrumbHome'), href: '/' }, { label: t('breadcrumbChecklist') }]} />
        </div>
        <h1 className="text-2xl print:text-xl font-semibold">{t('title')}</h1>
        <p className="text-muted text-sm print:text-xs">{t('subtitle')}</p>
      </Card>

      <div className="flex w-full gap-3 flex-col lg:flex-row print:block">
        <div className="flex flex-col gap-3 basis-2/3 min-w-0 print:basis-auto">
          <BuyerChecklistContent categories={categories} />
        </div>
        <div className="flex flex-col gap-3 basis-1/3 h-fit lg:sticky lg:top-26 print:hidden">
          <AboutRebuiltTitles />
        </div>
      </div>
    </div>
  );
}
