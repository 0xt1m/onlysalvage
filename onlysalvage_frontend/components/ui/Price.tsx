import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface PriceProps {
  value: number | undefined
  className?: string
}

function formatPrice(price: number) {
  const currency = "USD"
  const locale = "en-US"

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

export function Price({ value, className }: PriceProps) {
  const t = useTranslations('Price')
  return (
    <div className={cn(
      'flex items-center',
      className
    )}>
      <span className="font-semibold text-lg text-success">
        { value !== undefined ? formatPrice(value) : t('contactForPrice') }
      </span>
    </div>
  )
}