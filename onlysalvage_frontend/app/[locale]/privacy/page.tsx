import { Card } from '@/components/ui/Card';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how OnlySalvage collects, uses, and protects your information.",
};

export default async function PrivacyPolicyPage() {
  const t = await getTranslations('PrivacyPolicy');
  const sections = t.raw('sections') as { heading: string; body: string }[];

  return (
    <div className='w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 mb-6 gap-3 flex flex-col'>
      <BreadcrumbJsonLd items={[{ label: t('breadcrumbHome'), href: '/' }, { label: t('breadcrumbPrivacy') }]} />
      <Card>
        <Breadcrumb items={[{ label: t('breadcrumbHome'), href: '/' }, { label: t('breadcrumbPrivacy') }]} />
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-xs text-muted">{t('lastUpdated')}</p>
      </Card>

      <Card className="gap-6 max-w-3xl">
        <p className="text-sm text-foreground whitespace-pre-line">{t('intro')}</p>
        {sections.map((section) => (
          <div key={section.heading} className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold">{section.heading}</h3>
            <p className="text-sm text-muted whitespace-pre-line">{section.body}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}
