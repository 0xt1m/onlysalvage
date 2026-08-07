import { Lightbulb } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui/Card'

export async function AboutRebuiltTitles() {
  const t = await getTranslations('Checklist.aboutRebuilt')

  return (
    <Card className="gap-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-primary-light/10 flex items-center justify-center shrink-0">
          <Lightbulb className="w-4 h-4 text-primary-light" />
        </div>
        <h3 className="text-base font-semibold">{t('title')}</h3>
      </div>
      <p className="text-sm text-muted">{t('paragraph1')}</p>
      <p className="text-sm text-muted">{t('paragraph2')}</p>
      <p className="text-sm text-muted">{t('paragraph3')}</p>
    </Card>
  )
}
