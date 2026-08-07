import { Check, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

// Preview only -- nothing here is wired to a real subscription/billing
// system yet, hence every tier's action button stays disabled. Exists so
// the pricing/feature layout can be reviewed before that gets built.
const TIERS = [
  {
    id: 'free',
    featureCount: 4,
    highlighted: false,
  },
  {
    id: 'plus',
    featureCount: 5,
    highlighted: true,
  },
  {
    id: 'dealerPro',
    featureCount: 6,
    highlighted: false,
  },
] as const

export function SubscriptionTiers() {
  const t = useTranslations('SubscriptionTiers')

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
      {TIERS.map((tier) => {
        const features = Array.from({ length: tier.featureCount }, (_, i) =>
          t(`${tier.id}.features.${i}`)
        )

        return (
          <div
            key={tier.id}
            className={cn(
              'relative flex flex-col gap-4 rounded-lg border p-5',
              tier.highlighted ? 'border-primary-light shadow-md' : 'border-border'
            )}
          >
            {tier.highlighted && (
              <Badge
                label={t('mostPopular')}
                variant="primary"
                className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1"
              />
            )}

            <div className="flex flex-col gap-1">
              <h4 className="text-lg font-semibold text-foreground">{t(`${tier.id}.name`)}</h4>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">{t(`${tier.id}.price`)}</span>
                {t(`${tier.id}.priceSuffix`) && (
                  <span className="text-sm text-muted">{t(`${tier.id}.priceSuffix`)}</span>
                )}
              </div>
              <p className="text-sm text-muted">{t(`${tier.id}.tagline`)}</p>
            </div>

            <ul className="flex flex-col gap-2 flex-1">
              {features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                  {feature}
                </li>
              ))}
            </ul>

            <Button
              variant={tier.highlighted ? 'primary' : 'secondary'}
              disabled
              className="w-full flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {t('comingSoon')}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
