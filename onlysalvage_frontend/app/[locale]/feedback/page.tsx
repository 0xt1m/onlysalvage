import { Card } from '@/components/ui/Card';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd';
import { FeedbackForm } from '@/components/feedback/FeedbackForm';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Feedback",
  description: "Suggest a feature or report a bug on OnlySalvage.",
};

export default async function FeedbackPage() {
  const t = await getTranslations('Feedback');

  return (
    <div className="w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 mb-6 gap-3 flex flex-col">
      <BreadcrumbJsonLd items={[{ label: t('breadcrumbHome'), href: '/' }, { label: t('breadcrumbFeedback') }]} />
      <Card className="max-w-2xl">
        <Breadcrumb items={[{ label: t('breadcrumbHome'), href: '/' }, { label: t('breadcrumbFeedback') }]} />
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted text-sm">{t('subtitle')}</p>
      </Card>

      <FeedbackForm />
    </div>
  );
}
