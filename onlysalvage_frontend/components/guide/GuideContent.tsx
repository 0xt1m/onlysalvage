'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search, ArrowRight, Sparkles } from 'lucide-react'
import {
  MousePointerClick, GitCompare, Heart, MapPin,
  FileEdit, RefreshCw, EyeOff, Upload, ScanLine, Store,
  BadgeCheck, KeyRound, Star, Phone, Lock, RotateCcw, UserCog, LayoutGrid, Rocket,
  MessageSquare, ShoppingCart,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'
import {
  ContextMenuMockup, CompareMockup,
  PublishToggleMockup, ApiTokenMockup,
  ContactSellerMockup, PhonePrivacyMockup,
  ProfileEditMockup, OwnListingBorderMockup, EditListingMockup,
  VisitProfileStepMockup, ReviewsCardStepMockup, StarRatingStepMockup, SubmitReviewStepMockup,
  SearchFiltersStepMockup, BuyCompareStepMockup, TestDriveStepMockup, GoToChecklistStepMockup,
  SellNavStepMockup, DownloadTemplateStepMockup, UploadCsvStepMockup, ReviewDraftsStepMockup,
  VinAutofillStepMockup, AddPhotosStepMockup, PriceDescriptionStepMockup, PublishOrDraftStepMockup, ManageListingStepMockup,
  LoginPageStepMockup, ForgotPasswordLinkStepMockup, CheckEmailStepMockup, NewPasswordStepMockup,
} from './GuideMockups'
import type { ComponentType } from 'react'

interface Tip { heading: string; body: string; steps?: string[] }
interface Category { title: string; tips: Tip[] }

// Fixed per tip, in the same order as the `tips` arrays in each category's
// translation (see messages/*.json's Guide.categories) -- icons/mockups/links
// aren't translatable content, so they're matched up by position here.
const CATEGORY_ICONS: ComponentType<{ className?: string }>[][] = [
  [MousePointerClick, GitCompare, Heart, MapPin, Sparkles, Star, Phone, MessageSquare, LayoutGrid, ShoppingCart],
  [FileEdit, MousePointerClick, EyeOff, RefreshCw, Upload, ScanLine, Store, Lock, Rocket],
  [BadgeCheck, KeyRound, RotateCcw, UserCog],
]

// Only for regular (non-walkthrough) tips -- a walkthrough tip's steps each
// get their own icon instead (see STEP_ICONS below).
const MOCKUPS: Record<string, ComponentType> = {
  '0-0': ContextMenuMockup,
  '0-1': CompareMockup,
  '0-6': ContactSellerMockup,
  '0-8': OwnListingBorderMockup,
  '1-1': EditListingMockup,
  '1-2': PublishToggleMockup,
  '1-7': PhonePrivacyMockup,
  '2-1': ApiTokenMockup,
  '2-3': ProfileEditMockup,
}

// A full mini illustration per step -- showing roughly *where* the action
// lives on the real page (see GuideMockups.tsx's comment on each one) rather
// than just a generic numbered icon. A step whose tip isn't listed here (or
// whose own steps array is longer than its mockup list) just falls back to a
// plain numbered circle -- see the `StepMockup` lookup below.
const STEP_MOCKUPS: Record<string, ComponentType[]> = {
  '0-7': [VisitProfileStepMockup, ReviewsCardStepMockup, StarRatingStepMockup, SubmitReviewStepMockup],
  '0-9': [SearchFiltersStepMockup, BuyCompareStepMockup, TestDriveStepMockup, GoToChecklistStepMockup],
  '1-4': [SellNavStepMockup, DownloadTemplateStepMockup, UploadCsvStepMockup, ReviewDraftsStepMockup],
  '1-8': [VinAutofillStepMockup, AddPhotosStepMockup, PriceDescriptionStepMockup, PublishOrDraftStepMockup, ManageListingStepMockup],
  '2-2': [LoginPageStepMockup, ForgotPasswordLinkStepMockup, CheckEmailStepMockup, NewPasswordStepMockup],
}

// Where a tip is about a concrete page rather than something contextual to
// a specific listing (e.g. "renew this listing"), link straight to it.
// Labels are pulled from each destination's own existing translations
// (Nav/Footer/Sell/Developers) rather than new strings, so every locale is
// already covered.
const TIP_LINKS: Record<string, { href: string; label: (t: (key: string, ns?: string) => string) => string }> = {
  '0-0': { href: '/inventory', label: (t) => t('inventory', 'Nav') },
  '0-1': { href: '/compare', label: (t) => t('compare', 'Nav') },
  '0-2': { href: '/liked', label: (t) => t('likedCars', 'Nav') },
  '0-3': { href: '/inventory', label: (t) => t('inventory', 'Nav') },
  '0-4': { href: '/inventory', label: (t) => t('inventory', 'Nav') },
  '0-5': { href: '/', label: (t) => t('home', 'Nav') },
  '0-6': { href: '/inventory', label: (t) => t('inventory', 'Nav') },
  '0-7': { href: '/sellers', label: (t) => t('sellers', 'Footer') },
  '0-9': { href: '/checklist', label: (t) => t('checklist', 'Footer') },
  '1-0': { href: '/sell', label: (t) => t('sell', 'Nav') },
  '1-4': { href: '/sell/bulk', label: (t) => t('bulkUploadLink', 'Sell') },
  '1-5': { href: '/sell', label: (t) => t('sell', 'Nav') },
  '1-6': { href: '/settings', label: (t) => t('settings', 'Nav') },
  '1-7': { href: '/settings', label: (t) => t('settings', 'Nav') },
  '1-8': { href: '/sell', label: (t) => t('sell', 'Nav') },
  '2-0': { href: '/settings', label: (t) => t('settings', 'Nav') },
  '2-1': { href: '/developers', label: (t) => t('title', 'Developers') },
  '2-2': { href: '/login', label: (t) => t('logIn', 'Nav') },
  '2-3': { href: '/settings', label: (t) => t('settings', 'Nav') },
}

export function GuideContent({ categories }: { categories: Category[] }) {
  const t = useTranslations('Guide')
  const tNav = useTranslations('Nav')
  const tFooter = useTranslations('Footer')
  const tSell = useTranslations('Sell')
  const tDevelopers = useTranslations('Developers')

  const resolveLabel = (key: string, ns?: string) => {
    if (ns === 'Footer') return tFooter(key)
    if (ns === 'Sell') return tSell(key)
    if (ns === 'Developers') return tDevelopers(key)
    return tNav(key)
  }

  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  // Every tip carries its original (ci, ti) position even after filtering,
  // so anchor ids/icons/mockups/links -- all keyed off that original
  // position -- stay correct no matter what a search narrows down to.
  const positioned = useMemo(
    () => categories.map((category, ci) => ({
      title: category.title,
      tips: category.tips.map((tip, ti) => ({ ...tip, ci, ti })),
    })),
    [categories]
  )

  const filtered = useMemo(() => {
    if (!q) return positioned
    return positioned
      .map((category) => ({
        ...category,
        tips: category.tips.filter(
          (tip) => tip.heading.toLowerCase().includes(q) || tip.body.toLowerCase().includes(q)
        ),
      }))
      .filter((category) => category.tips.length > 0)
  }, [positioned, q])

  // Step-by-step tips (heading + numbered steps, e.g. "How to sell a car")
  // get pulled out of the regular per-category list into their own bigger,
  // illustrated section below -- a one-line row with a thumbnail-sized
  // mockup does a real multi-step walkthrough a disservice. Still findable
  // through search/the TOC like any other tip, just rendered differently.
  const walkthroughs = useMemo(
    () => filtered.flatMap((category) => category.tips.filter((tip) => tip.steps)),
    [filtered]
  )
  const walkthroughKeys = useMemo(() => new Set(walkthroughs.map((tip) => `${tip.ci}-${tip.ti}`)), [walkthroughs])

  const regularCategories = useMemo(
    () => filtered
      .map((category) => ({
        ...category,
        tips: category.tips.filter((tip) => !walkthroughKeys.has(`${tip.ci}-${tip.ti}`)),
      }))
      .filter((category) => category.tips.length > 0),
    [filtered, walkthroughKeys]
  )

  return (
    <div className="flex flex-col lg:flex-row w-full gap-3">
      <Card className="w-full lg:basis-1/4 h-fit lg:sticky lg:top-26 lg:self-start gap-3">
        <Input
          placeholder={t('searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          suffix={<Search className="w-4 h-4 text-muted" />}
        />
        <nav className="flex flex-col gap-0.5 max-h-[70vh] overflow-y-auto">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide px-1 mb-1">{t('tableOfContents')}</p>
          {filtered.length === 0 && <p className="text-sm text-muted px-1">{t('noResults')}</p>}
          {filtered.map((category) => (
            <div key={category.title} className="mb-2">
              <p className="text-xs font-medium text-foreground px-1 mb-1">{category.title}</p>
              {category.tips.map((tip) => (
                <a
                  key={`${tip.ci}-${tip.ti}`}
                  href={`#guide-tip-${tip.ci}-${tip.ti}`}
                  className="block text-sm text-muted hover:text-primary-light px-1 py-1 rounded truncate transition-colors"
                >
                  {tip.heading}
                </a>
              ))}
            </div>
          ))}
        </nav>
      </Card>

      <div className="flex flex-col gap-3 w-full lg:basis-3/4 min-w-0">
        {filtered.length === 0 && (
          <Card className="items-center text-center py-10">
            <p className="text-sm text-muted">{t('noResults')}</p>
          </Card>
        )}

        {walkthroughs.length > 0 && (
          <Card className="gap-5">
            <h2 className="text-lg font-semibold">{t('walkthroughsTitle')}</h2>
            <div className="flex flex-col gap-5">
              {walkthroughs.map((tip) => {
                const key = `${tip.ci}-${tip.ti}`
                const Icon = CATEGORY_ICONS[tip.ci]?.[tip.ti] ?? Sparkles
                const stepMockups = STEP_MOCKUPS[key]
                const tipLink = TIP_LINKS[key]

                return (
                  <div
                    key={key}
                    id={`guide-tip-${tip.ci}-${tip.ti}`}
                    className="flex flex-col gap-4 rounded-xl border border-border p-4 scroll-mt-26"
                  >
                    <div className="flex items-center gap-3">
                      <div className="shrink-0 w-9 h-9 rounded-lg bg-primary-light/10 flex items-center justify-center">
                        <Icon className="w-4.5 h-4.5 text-primary-light" />
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{tip.heading}</p>
                        <p className="text-xs text-muted">{tip.body}</p>
                      </div>
                    </div>

                    <ol className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {tip.steps?.map((step, stepIndex) => {
                        const StepMockup = stepMockups?.[stepIndex]
                        return (
                          <li key={stepIndex} className="flex flex-col gap-2 rounded-lg bg-background border border-border p-3">
                            {StepMockup ? (
                              <div className="relative">
                                <StepMockup />
                                <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-primary-light text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
                                  {stepIndex + 1}
                                </span>
                              </div>
                            ) : (
                              <div className="relative w-10 h-10 rounded-lg bg-primary-light/10 flex items-center justify-center">
                                <span className="text-sm font-semibold text-primary-light">{stepIndex + 1}</span>
                                <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-primary-light text-white text-[10px] font-bold flex items-center justify-center">
                                  {stepIndex + 1}
                                </span>
                              </div>
                            )}
                            <p className="text-xs text-muted">{step}</p>
                          </li>
                        )
                      })}
                    </ol>

                    {tipLink && (
                      <Link
                        href={tipLink.href}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary-light hover:underline w-fit"
                      >
                        {t('goTo')} {tipLink.label(resolveLabel)}
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {regularCategories.map((category) => (
          <Card key={category.title} className="gap-4">
            <h2 className="text-lg font-semibold">{category.title}</h2>
            <div className="flex flex-col">
              {category.tips.map((tip, displayIndex) => {
                const key = `${tip.ci}-${tip.ti}`
                const Icon = CATEGORY_ICONS[tip.ci]?.[tip.ti] ?? Sparkles
                const Mockup = MOCKUPS[key]
                const tipLink = TIP_LINKS[key]
                const isLast = displayIndex === category.tips.length - 1

                return (
                  <div
                    key={key}
                    id={`guide-tip-${tip.ci}-${tip.ti}`}
                    className={cn(
                      'flex flex-col sm:flex-row sm:items-center gap-4 py-4 scroll-mt-26',
                      !isLast && 'border-b border-border',
                      displayIndex === 0 && 'pt-0',
                      isLast && 'pb-0'
                    )}
                  >
                    <div className="flex gap-3 flex-1 min-w-0">
                      <div className="shrink-0 w-9 h-9 rounded-lg bg-primary-light/10 flex items-center justify-center">
                        <Icon className="w-4.5 h-4.5 text-primary-light" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-medium text-foreground">{tip.heading}</p>
                        <p className="text-sm text-muted">{tip.body}</p>
                        {tipLink && (
                          <Link
                            href={tipLink.href}
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary-light hover:underline mt-2 w-fit"
                          >
                            {t('goTo')} {tipLink.label(resolveLabel)}
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                    {Mockup && <Mockup />}
                  </div>
                )
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
