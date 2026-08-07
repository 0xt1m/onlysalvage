import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

export function Footer() {
  const t = useTranslations('Footer')

  return (
    <footer className="w-full bg-surface border-t border-border px-4 xs:px-5 sm:px-6 py-12 mt-auto print:hidden">
      <div className="max-w-[1600px] mx-auto grid gap-10 md:grid-cols-4">

        {/* Brand */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">OnlySalvage</h2>
          <p className="text-sm text-muted">
            {t('tagline')}
          </p>
        </div>

        {/* Navigation */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">{t('company')}</h3>
          <div className="flex flex-col gap-2">
            <Link href="/about" className="text-sm text-muted hover:text-foreground transition-colors">{t('about')}</Link>
            <Link href="/makes" className="text-sm text-muted hover:text-foreground transition-colors">{t('shopByMake')}</Link>
            <Link href="/body-styles" className="text-sm text-muted hover:text-foreground transition-colors">{t('shopByBodyStyle')}</Link>
            <Link href="/sellers" className="text-sm text-muted hover:text-foreground transition-colors">{t('sellers')}</Link>
            <Link href="/guide" className="text-sm text-muted hover:text-foreground transition-colors">{t('guide')}</Link>
            <Link href="/checklist" className="text-sm text-muted hover:text-foreground transition-colors">{t('checklist')}</Link>
            <Link href="/developers" className="text-sm text-muted hover:text-foreground transition-colors">{t('apiDocs')}</Link>
            <Link href="/feedback" className="text-sm text-muted hover:text-foreground transition-colors">{t('feedback')}</Link>
            <Link href="/contact" className="text-sm text-muted hover:text-foreground transition-colors">{t('contact')}</Link>
          </div>
        </div>

        {/* Legal */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">{t('legal')}</h3>
          <div className="flex flex-col gap-2">
            <Link href="/privacy" className="text-sm text-muted hover:text-foreground transition-colors">{t('privacyPolicy')}</Link>
            <Link href="/terms" className="text-sm text-muted hover:text-foreground transition-colors">{t('termsOfService')}</Link>
          </div>
        </div>

        {/* Extras / Social */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">{t('followUs')}</h3>
          <div className="flex flex-col gap-2 text-muted">
            <a href="#" className="text-sm hover:text-foreground transition-colors">Twitter</a>
            <a href="#" className="text-sm hover:text-foreground transition-colors">Instagram</a>
            <a href="#" className="text-sm hover:text-foreground transition-colors">Facebook</a>
          </div>
        </div>

      </div>

      {/* Bottom bar */}
      <div className="max-w-[1600px] mx-auto mt-10 pt-6 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted">
          {t('copyright')}
        </p>

        <div className="flex gap-4 text-sm text-muted">
          <Link href="/privacy" className="hover:text-foreground">{t('privacy')}</Link>
          <Link href="/terms" className="hover:text-foreground">{t('terms')}</Link>
        </div>
      </div>
    </footer>
  )
}
