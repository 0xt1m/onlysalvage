import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd';
import { FaqAccordion } from '@/components/support/FaqAccordion';
import { ContactForm } from '@/components/support/ContactForm';
import { Link } from '@/i18n/navigation';
import { Mail, Phone, Clock, MessageSquarePlus, BookOpen } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Support",
  description: "Get help buying or selling on OnlySalvage. Browse FAQs about listings, watchlists, seller ratings, and account settings, or contact our support team.",
};

const SUPPORT_EMAIL = "support@onlysalvage.com";
const SUPPORT_PHONE = "+1 864-753-5956";

// Parallel to buyingFaqs/sellingFaqs/accountFaqs below (see messages/*.json's
// Support namespace) -- each entry is the Guide page anchor (see guide/
// page.tsx's "guide-tip-{categoryIndex}-{tipIndex}" ids) that answers the
// same question in more depth. Kept here rather than in the translations
// since it's a structural link between two pages, not translatable content.
const BUYING_GUIDE_LINKS = ['guide-tip-0-6', 'guide-tip-0-2', 'guide-tip-0-5', 'guide-tip-0-7'];
const SELLING_GUIDE_LINKS = ['guide-tip-1-8', 'guide-tip-1-1', 'guide-tip-1-7', 'guide-tip-1-6'];
// "Can I leave a review for a seller?" points at the same guide-tip-0-7
// walkthrough as buyingFaqs' "Can I trust a seller's rating?" above -- one
// comprehensive "How to leave a review" section now answers both.
const ACCOUNT_GUIDE_LINKS = ['guide-tip-2-2', 'guide-tip-0-7', 'guide-tip-2-3'];

export default async function SupportPage() {
  const t = await getTranslations('Support');

  const buyingFaqs = t.raw('buyingFaqs') as { question: string; answer: string }[];
  const sellingFaqs = t.raw('sellingFaqs') as { question: string; answer: string }[];
  const accountFaqs = t.raw('accountFaqs') as { question: string; answer: string }[];

  return (
    <div className='w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 mb-6 gap-3 flex flex-col'>
      <BreadcrumbJsonLd items={[{ label: t('breadcrumbHome'), href: "/" }, { label: t('breadcrumbSupport') }]} />
      <Card>
        <Breadcrumb items={[{ label: t('breadcrumbHome'), href: "/" }, { label: t('breadcrumbSupport') }]} />
        <div>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-muted text-sm">{t('subtitle')}</p>
        </div>
      </Card>

      <div className="flex w-full gap-3 flex-col lg:flex-row">
        <div className="flex flex-col gap-3 basis-2/3 min-w-0">
          <Card>
            <h3 className="text-lg font-semibold">{t('buyingTitle')}</h3>
            <FaqAccordion items={buyingFaqs} guideLinks={BUYING_GUIDE_LINKS} />
          </Card>

          <Card>
            <h3 className="text-lg font-semibold">{t('sellingTitle')}</h3>
            <FaqAccordion items={sellingFaqs} guideLinks={SELLING_GUIDE_LINKS} />
          </Card>

          <Card>
            <h3 className="text-lg font-semibold">{t('accountTitle')}</h3>
            <FaqAccordion items={accountFaqs} guideLinks={ACCOUNT_GUIDE_LINKS} />
          </Card>
        </div>

        <div className="flex flex-col gap-3 basis-1/3 h-fit">
          <Card>
            <h3 className="text-lg font-semibold">{t('stillNeedHelpTitle')}</h3>
            <p className="text-sm text-muted">{t('stillNeedHelpDescription')}</p>

            <ContactForm />

            <div className="border-t border-border mt-1 pt-3 flex flex-col gap-1">
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex items-center gap-2 text-primary-light hover:text-primary-hover font-medium"
              >
                <Mail className="w-4 h-4" />
                {SUPPORT_EMAIL}
              </a>
              <a
                href={`tel:${SUPPORT_PHONE}`}
                className="flex items-center gap-2 text-primary-light hover:text-primary-hover font-medium"
              >
                <Phone className="w-4 h-4" />
                {SUPPORT_PHONE}
              </a>
              <div className="flex items-center gap-2 text-sm text-muted mt-1">
                <Clock className="w-4 h-4" />
                {t('availability')}
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold">{t('feedbackTitle')}</h3>
            <p className="text-sm text-muted">{t('feedbackDescription')}</p>
            <Link href="/feedback">
              <Button variant="secondary" size="sm" className="flex items-center gap-2 mt-1">
                <MessageSquarePlus className="w-4 h-4" />
                {t('feedbackLink')}
              </Button>
            </Link>
          </Card>
        </div>
      </div>

      <Card className="items-center text-center">
        <BookOpen className="w-6 h-6 text-primary-light" />
        <h3 className="text-lg font-semibold">{t('browseGuideTitle')}</h3>
        <p className="text-sm text-muted max-w-[480px]">{t('browseGuideDescription')}</p>
        <Link href="/guide">
          <Button variant="secondary" size="sm" className="flex items-center gap-2 mt-1">
            <BookOpen className="w-4 h-4" />
            {t('browseGuide')}
          </Button>
        </Link>
      </Card>
    </div>
  );
}
