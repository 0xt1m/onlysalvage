import Image from 'next/image'
import { Mail, ShieldCheck, Star, Headset, MapPinned } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

interface AuthInfoPanelProps {
  eyebrow?: string
  className?: string
}

export async function AuthInfoPanel({ eyebrow, className }: AuthInfoPanelProps) {
  const t = await getTranslations('Auth')
  const tHome = await getTranslations('Home')

  const points = [
    { icon: ShieldCheck, label: tHome('trust.verifiedTitle') },
    { icon: Star, label: tHome('trust.ratedTitle') },
    { icon: Headset, label: tHome('trust.supportTitle') },
    { icon: MapPinned, label: tHome('trust.reachTitle') },
  ]

  return (
    <Card className={cn('bg-hero border-hero justify-between gap-6', className)}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          {/* Same mark used everywhere else in the app (navbar, favicon,
              share images) -- its coral color reads fine against this
              card's dark "hero" navy background regardless of site theme. */}
          <Image src="/2.svg" width={48} height={48} alt="OnlySalvage" className="shrink-0" />
          <div>
            {eyebrow && <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">{eyebrow}</p>}
            <h2 className="text-white text-2xl font-bold">OnlySalvage</h2>
          </div>
        </div>

        <p className="text-white/80 text-sm leading-relaxed">{t('appTagline1')}</p>

        <div className="flex flex-col gap-3 pt-2">
          {points.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 shrink-0">
                <Icon className="w-4 h-4 text-white" />
              </span>
              <span className="text-white/90 text-sm font-medium">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <a
        href="mailto:support@onlysalvage.com"
        className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium transition-colors w-fit"
      >
        <Mail className="w-4 h-4" />
        support@onlysalvage.com
      </a>
    </Card>
  )
}
