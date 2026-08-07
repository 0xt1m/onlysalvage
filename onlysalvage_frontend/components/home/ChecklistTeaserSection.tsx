import { ListChecks, ArrowRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Link } from '@/i18n/navigation'

export async function ChecklistTeaserSection() {
  const t = await getTranslations('Home')

  return (
    <Card className="flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="shrink-0 w-10 h-10 rounded-lg bg-primary-light/10 flex items-center justify-center">
        <ListChecks className="w-5 h-5 text-primary-light" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-primary-light uppercase tracking-wide">{t('checklistTeaser.label')}</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{t('checklistTeaser.heading')}</p>
        <p className="text-sm text-muted mt-0.5">{t('checklistTeaser.description')}</p>
      </div>
      <Link href="/checklist" className="shrink-0">
        <Button variant="secondary" size="sm" className="flex items-center gap-2">
          {t('checklistTeaser.viewChecklist')}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </Link>
    </Card>
  )
}
