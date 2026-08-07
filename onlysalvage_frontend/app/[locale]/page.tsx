import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SearchBlock } from "@/components/ui/SearchBlock";
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ListingResultsGrid } from '@/components/listings/ListingResultsGrid';
import { TopRatedSellers } from '@/components/home/TopRatedSellers';
import { NearYouSection } from '@/components/home/NearYouSection';
import { BecauseYouViewed } from '@/components/home/BecauseYouViewed';
import { GuideTipSection } from '@/components/home/GuideTipSection';
import { ChecklistTeaserSection } from '@/components/home/ChecklistTeaserSection';
import { getListingsServer, getTopRatedSellersServer, getVerifiedSellersServer, getFeaturedListingsServer, getMostLikedListingsServer, getMostViewedListingsServer, getRecommendedListingsServer, getMakesServer, getCitiesServer, getVehicleTypesWithListingsServer, getMeServer } from '@/lib/api-server';
import { slugify } from '@/lib/utils';
import { VEHICLE_TYPES } from '@/lib/types';
import { ShieldCheck, Star, Headset, MapPinned, Plus, Search, MessageCircle, CircleCheckBig } from 'lucide-react';

export const dynamic = 'force-dynamic'

export default async function Home() {
  const t = await getTranslations('Home');
  const tAttr = await getTranslations('VehicleAttributes');
  const tGuide = await getTranslations('Guide');
  const guideCategories = tGuide.raw('categories') as { title: string; tips: { heading: string; body: string }[] }[];

  const trustPoints = [
    { icon: ShieldCheck, title: t('trust.verifiedTitle'), description: t('trust.verifiedDescription') },
    { icon: Star, title: t('trust.ratedTitle'), description: t('trust.ratedDescription') },
    { icon: Headset, title: t('trust.supportTitle'), description: t('trust.supportDescription') },
    { icon: MapPinned, title: t('trust.reachTitle'), description: t('trust.reachDescription') },
  ];

  const howItWorksSteps = [
    { icon: Search, title: t('howItWorks.step1Title'), description: t('howItWorks.step1Description') },
    { icon: MessageCircle, title: t('howItWorks.step2Title'), description: t('howItWorks.step2Description') },
    { icon: CircleCheckBig, title: t('howItWorks.step3Title'), description: t('howItWorks.step3Description') },
  ];

  const [featured, recent, topSellers, verifiedSellers, mostLiked, mostViewed, recommended, makes, cities, availableVehicleTypes, verifiedListings, me] = await Promise.all([
    getFeaturedListingsServer(4),
    getListingsServer({ ordering: '-created_at', exclude_sold: 'true' }),
    getTopRatedSellersServer(4),
    getVerifiedSellersServer(4),
    getMostLikedListingsServer(4),
    getMostViewedListingsServer(4),
    getRecommendedListingsServer(4),
    getMakesServer(),
    getCitiesServer(),
    getVehicleTypesWithListingsServer(),
    getListingsServer({ verified_seller: 'true', ordering: '-created_at', exclude_sold: 'true', page_size: '4' }),
    getMeServer(),
  ]);

  const shopableVehicleTypes = VEHICLE_TYPES.filter((type) => availableVehicleTypes.includes(type.value));

  return (
    <div className="w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 mb-10 gap-8 flex flex-col">
      <SearchBlock
        variant="hero"
        title={t('heroTitle')}
        subtitle={t('heroSubtitle')}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {trustPoints.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="items-start gap-2">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <h4 className="font-semibold text-foreground">{title}</h4>
            <p className="text-sm text-muted">{description}</p>
          </Card>
        ))}
      </div>

      <GuideTipSection categories={guideCategories} />

      {featured.length > 0 && (
        <Card className="p-3 sm:p-6">
          <SectionHeader
            title={t('featuredTitle')}
            subtitle={t('featuredSubtitle')}
            viewAllHref="/inventory"
          />
          <ListingResultsGrid listings={featured} variant="v" columns={4} currentUsername={me?.username} />
        </Card>
      )}

      <Card className="p-3 sm:p-6">
        <SectionHeader
          title={t('newArrivalsTitle')}
          subtitle={t('newArrivalsSubtitle')}
          viewAllHref="/inventory"
        />
        <ListingResultsGrid
          listings={recent.results.slice(0, 4)}
          variant="v"
          columns={4}
          emptyMessage={t('noListingsYet')}
          currentUsername={me?.username}
        />
      </Card>

      {recommended.length > 0 ? (
        <Card className="p-3 sm:p-6">
          <SectionHeader
            title={t('recommendedTitle')}
            subtitle={t('recommendedSubtitle')}
            viewAllHref="/inventory"
          />
          <ListingResultsGrid listings={recommended} variant="v" columns={4} currentUsername={me?.username} />
        </Card>
      ) : (
        <BecauseYouViewed />
      )}

      <NearYouSection />

      <Card className="bg-hero border-hero items-center text-center gap-3 py-10">
        <h3 className="text-2xl font-semibold text-white">{t('ctaTitle')}</h3>
        <p className="text-white/80 max-w-md">
          {t('ctaDescription')}
        </p>
        <Link href="/sell">
          <Button variant="secondary" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t('sellYourCar')}
          </Button>
        </Link>
      </Card>

      {mostLiked.length > 0 && (
        <Card className="p-3 sm:p-6">
          <SectionHeader
            title={t('mostLikedTitle')}
            subtitle={t('mostLikedSubtitle')}
            viewAllHref="/inventory"
          />
          <ListingResultsGrid listings={mostLiked} variant="v" columns={4} currentUsername={me?.username} />
        </Card>
      )}

      {mostViewed.length > 0 && (
        <Card className="p-3 sm:p-6">
          <SectionHeader
            title={t('mostViewedTitle')}
            subtitle={t('mostViewedSubtitle')}
            viewAllHref="/inventory"
          />
          <ListingResultsGrid listings={mostViewed} variant="v" columns={4} currentUsername={me?.username} />
        </Card>
      )}

      {verifiedListings.results.length > 0 && (
        <Card className="p-3 sm:p-6">
          <SectionHeader
            title={t('verifiedListingsTitle')}
            subtitle={t('verifiedListingsSubtitle')}
            viewAllHref="/inventory"
          />
          <ListingResultsGrid listings={verifiedListings.results} variant="v" columns={4} currentUsername={me?.username} />
        </Card>
      )}

      <Card>
        <SectionHeader
          title={t('howItWorks.title')}
          subtitle={t('howItWorks.subtitle')}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-2">
          {howItWorksSteps.map(({ icon: Icon, title, description }, i) => (
            <div key={title} className="flex flex-col items-center text-center gap-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
              </div>
              <h4 className="font-semibold text-foreground">{title}</h4>
              <p className="text-sm text-muted max-w-xs">{description}</p>
            </div>
          ))}
        </div>
      </Card>

      <ChecklistTeaserSection />

      {topSellers.length > 0 && (
        <Card>
          <SectionHeader
            title={t('topSellersTitle')}
            subtitle={t('topSellersSubtitle')}
            viewAllHref="/sellers"
          />
          <TopRatedSellers sellers={topSellers} currentUsername={me?.username} />
        </Card>
      )}

      {verifiedSellers.length > 0 && (
        <Card>
          <SectionHeader
            title={t('verifiedSellersTitle')}
            subtitle={t('verifiedSellersSubtitle')}
            viewAllHref="/sellers"
          />
          <TopRatedSellers sellers={verifiedSellers} currentUsername={me?.username} />
        </Card>
      )}

      {makes.length > 0 && (
        <Card>
          <SectionHeader
            title={t('shopByMakeTitle')}
            subtitle={t('shopByMakeSubtitle')}
            viewAllHref="/makes"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {makes.slice(0, 8).map((make) => (
              <Link
                key={make.id}
                href={`/makes/${slugify(make.name)}`}
                className="p-4 border border-border rounded-lg text-center font-medium text-foreground hover:bg-surface-raised hover:border-primary-light transition-colors"
              >
                {make.name}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {shopableVehicleTypes.length > 0 && (
        <Card>
          <SectionHeader
            title={t('shopByBodyStyleTitle')}
            subtitle={t('shopByBodyStyleSubtitle')}
            viewAllHref="/body-styles"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {shopableVehicleTypes.map((type) => (
              <Link
                key={type.value}
                href={`/body-styles/${slugify(type.label)}`}
                className="p-4 border border-border rounded-lg text-center font-medium text-foreground hover:bg-surface-raised hover:border-primary-light transition-colors"
              >
                {tAttr(`vehicleType.${type.value}`)}
              </Link>
            ))}
          </div>
        </Card>
      )}

      {cities.length > 0 && (
        <Card>
          <SectionHeader
            title={t('shopByCityTitle')}
            subtitle={t('shopByCitySubtitle')}
            viewAllHref="/cities"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {cities.slice(0, 8).map((city) => (
              <Link
                key={`${city.city}-${city.state}`}
                href={`/cities/${slugify(city.city)}-${city.state.toLowerCase()}`}
                className="p-4 border border-border rounded-lg text-center font-medium text-foreground hover:bg-surface-raised hover:border-primary-light transition-colors"
              >
                {city.city}, {city.state}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
