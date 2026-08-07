'use client'

import { useState } from 'react';
import { Shuffle } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Link, useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { getRandomListingSlug } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

interface SearchBlockProps {
  title: string;
  subtitle?: string;
  onSearch?: (query: string) => void;
  initialQuery?: string;
  variant?: 'compact' | 'hero';
}

export function SearchBlock({ title, subtitle, onSearch, initialQuery = '', variant = 'compact' }: SearchBlockProps) {
  const router = useRouter();
  const t = useTranslations('SearchBlock');
  const { user } = useAuth();
  const [query, setQuery] = useState(initialQuery);
  const [surpriseLoading, setSurpriseLoading] = useState(false);
  const isHero = variant === 'hero';

  const handleSurpriseMe = async () => {
    setSurpriseLoading(true);
    const slug = await getRandomListingSlug();
    if (slug) {
      router.push(`/inventory/${slug}`);
    } else {
      setSurpriseLoading(false);
    }
  };

  const defaultFilters = [
    // Redundant on the inventory page itself (that's where this chip list
    // always renders in "compact" mode) -- only worth showing as a jump-to-
    // browse shortcut on the "hero" variant (the home page).
    ...(isHero ? [{ name: t('filters.inventory'), href: "/inventory" }] : []),
    { name: t('filters.under5000'), href: "/inventory?max_price=5000" },
    { name: t('filters.under10000'), href: "/inventory?max_price=10000" },
    { name: t('filters.over10000'), href: "/inventory?min_price=10000" },
    { name: t('filters.allWheelDrive'), href: `/inventory?drive=${encodeURIComponent('All Wheel Drive')}` },
    { name: t('filters.rebuiltTitle'), href: `/inventory?title_document=${encodeURIComponent('Rebuilt')}` },
    { name: t('filters.privateSellers'), href: "/inventory?seller_type=private" },
    { name: t('filters.nearby'), href: "/inventory?nearby=true" },
    // Needs search/view history tied to an account -- see
    // recommendation_interest_filter on the backend, which returns nothing
    // for an anonymous request anyway, but there's no point showing the chip
    // at all if it can only ever lead to an empty results page.
    ...(user ? [{ name: t('filters.recommended'), href: "/inventory?recommended=true" }] : []),
  ]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();

    if (onSearch) {
      onSearch(trimmed);
    } else {
      router.push(trimmed ? `/inventory?search=${encodeURIComponent(trimmed)}` : '/inventory');
    }
  };

  return (
    <Card className={cn('flex-col items-center', isHero && 'bg-hero border-hero py-8 px-4 sm:py-12 sm:px-8')}>
      <h2 className={cn(
        'self-start text-primary-light text-2xl font-bold mb-4',
        isHero && 'self-center text-white text-2xl sm:text-3xl text-center mb-2'
      )}>
        {title}
      </h2>
      {isHero && subtitle && (
        <p className="text-white/80 text-sm sm:text-base text-center max-w-2xl mb-6">{subtitle}</p>
      )}
      <form onSubmit={handleSubmit} className={cn('flex gap-3 w-full', isHero && 'max-w-2xl')}>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="rounded-full pr-3"
        />
        <Button type="submit" className="rounded-full bg-accent hover:bg-accent-hover text-md shrink-0 px-4 sm:px-6">
          {t('search')}
        </Button>
      </form>
      <div className={cn('flex w-full gap-2 sm:gap-3 flex-wrap', isHero && 'max-w-2xl justify-center mt-2')}>
        {defaultFilters.map((filter) => (
          <Link key={filter.href} href={filter.href}>
            <Button
              variant="ghost"
              className={cn(
                'rounded-full text-md px-3 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base',
                isHero && 'border-primary-light text-white/80 hover:text-white hover:border-white'
              )}
            >
              {filter.name}
            </Button>
          </Link>
        ))}
        {isHero && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleSurpriseMe}
            disabled={surpriseLoading}
            className="rounded-full text-md px-3 py-1.5 text-sm sm:px-4 sm:py-2 sm:text-base border-primary-light text-white/80 hover:text-white hover:border-white flex items-center gap-1.5"
          >
            <Shuffle className="w-4 h-4" />
            {t('surpriseMe')}
          </Button>
        )}
      </div>
    </Card>
  )
}
