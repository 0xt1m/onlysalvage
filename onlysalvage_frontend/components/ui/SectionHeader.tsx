import { Link } from '@/i18n/navigation'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  viewAllHref?: string
}

export function SectionHeader({ title, subtitle, viewAllHref }: SectionHeaderProps) {
  const t = useTranslations('Common')
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h3 className="text-2xl font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="flex items-center gap-1 text-sm font-medium text-primary-light hover:text-primary-hover transition-colors shrink-0"
        >
          {t('viewAll')}
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  )
}
