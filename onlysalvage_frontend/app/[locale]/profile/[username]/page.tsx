import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/Card'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd';
import { getProfile, getListingsBySeller } from '@/lib/api';
import { getMeServer, getListingsServer, getListingsBySellerServer } from '@/lib/api-server';
import { Button } from '@/components/ui/Button';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { LeaveReviewModal } from '@/components/profile/LeaveReviewModal';
import { ReportSellerModal } from '@/components/profile/ReportSellerModal';
import { ListingResultsGrid } from '@/components/listings/ListingResultsGrid';
import { DraftsSection } from '@/components/profile/DraftsSection';
import { TranslatableText } from '@/components/ui/TranslatableText';
import { cn, formatAddress, formatMonthYear, formatPhoneNumber, formatTimeAgo, mapsSearchUrl, phoneTelHref, sellerDisplayName } from '@/lib/utils';
import { Phone, Globe, Mail, MapPin, Star, Plus, BadgeCheck, Calendar, Car, Settings, ShieldCheck, Upload } from 'lucide-react';
import { getTranslations, getLocale } from 'next-intl/server';
import type { Profile, ListingSummary } from '@/lib/types';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);

  if (!profile) {
    return { title: 'Profile not found' };
  }

  const displayName = sellerDisplayName(profile);
  const location = [profile.city, profile.state].filter(Boolean).join(', ');
  const description = `${displayName} is ${profile.is_dealer ? 'a dealer' : 'a private seller'} on OnlySalvage${location ? ` in ${location}` : ''}. View their active listings and reviews.`;

  return {
    title: `${displayName} (@${profile.username})`,
    description,
    alternates: { canonical: `/profile/${profile.username}` },
    openGraph: {
      title: displayName,
      description,
      type: 'profile',
      images: profile.profile_picture ? [{ url: profile.profile_picture }] : undefined,
    },
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const t = await getTranslations('Profile');
  const locale = await getLocale();

  const [profile, me]: [Profile | null, { username: string; email?: string; verification_status?: Profile['verification_status'] } | null] = await Promise.all([
    getProfile(username),
    getMeServer(),
  ]);

  if (!profile) {
    return (
      <div className='w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 gap-3 flex flex-col'>
        <Card className='items-center'>
          <h1 className="text-2xl">{t('userNotFoundTitle')}</h1>
          <p className="text-muted">{t('userNotFoundDescription', { username })}</p>
        </Card>
      </div>
    )
  }

  const isOwner = me?.username === username;

  const [listings, watchlist, drafts] = await Promise.all([
    // The owner sees their own paused (is_active=false) listings too, with
    // an Inactive badge (see ListingResultsGrid) -- that needs the
    // cookie-forwarding getListingsBySellerServer (proves ownership to the
    // backend via the auth cookie) rather than getListingsBySeller's plain,
    // unauthenticated fetch, which the backend would never treat as the
    // owner and would keep the usual is_active=true-only results for.
    isOwner ? getListingsBySellerServer(profile.id) : getListingsBySeller(profile.id),
    // Sold listings stay on the watchlist -- ListingCard already marks them
    // clearly (Sold badge, dimmed) rather than hiding them outright.
    // is_active=true is still the default in getListingsServer, so a paused
    // (not sold) listing is still excluded here; unlike a sale, that's not
    // permanent, and the Like row is never actually deleted either way, so
    // both come back on their own once the listing is active/available again.
    isOwner ? getListingsServer({ liked: 'true' }).then((r) => r.results) : Promise.resolve([] as ListingSummary[]),
    // The backend scopes `?status=DR` results to the requesting user's own
    // saved drafts regardless of who this profile page belongs to (see
    // ListingViewSet.get_queryset), but there's no reason to even ask
    // unless this is the owner's own page.
    isOwner ? getListingsServer({ status: 'DR' }).then((r) => r.results) : Promise.resolve([] as ListingSummary[]),
  ]);

  const reviews = profile.seller_reviews_received ?? [];
  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null;

  const location = [profile.city, profile.state].filter(Boolean).join(', ');
  // Exact street address is dealer-only -- the backend already clears it for
  // everyone else, but this keeps the page honest even against stale data.
  const fullAddress = formatAddress(profile.is_dealer ? profile : { ...profile, street_address: undefined });
  const displayName = sellerDisplayName(profile);

  return (
    <div className='w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 mb-6 gap-3 flex flex-col'>
      <BreadcrumbJsonLd items={[{ label: t('breadcrumbHome'), href: "/" }, { label: t('breadcrumbProfile') }]} />
      <Card>
        <Breadcrumb items={[{ label: t('breadcrumbHome'), href: "/" }, { label: t('breadcrumbProfile') }]} />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Avatar
              src={profile.profile_picture ?? undefined}
              name={displayName}
              size="lg"
              className="w-20 h-20 text-xl"
            />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold">{displayName}</h1>
                {profile.is_verified && (
                  <span title={t('verifiedBadge')}>
                    <BadgeCheck className="w-5 h-5 text-primary-light shrink-0" aria-label={t('verifiedBadge')} />
                  </span>
                )}
                {profile.is_dealer && <Badge label={t('dealerBadge')} variant="primary" />}
                {profile.is_dealer && profile.offers_financing && <Badge label={t('financingBadge')} variant="success" />}
              </div>
              <p className="text-muted">@{profile.username}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                {location && (
                  <p className="flex items-center gap-1 text-sm text-muted">
                    <MapPin className="w-4 h-4" /> {location}
                  </p>
                )}
                {profile.date_joined && (
                  <p className="flex items-center gap-1 text-sm text-muted">
                    <Calendar className="w-4 h-4" /> {t('memberSince', { date: formatMonthYear(profile.date_joined, locale) })}
                  </p>
                )}
                {!!profile.sold_listings_count && (
                  <p className="flex items-center gap-1 text-sm text-muted">
                    <Car className="w-4 h-4" /> {t('carsSold', { count: profile.sold_listings_count })}
                  </p>
                )}
              </div>
            </div>
          </div>
          {isOwner && (
            <Link href="/settings">
              <Button variant="secondary" size="sm" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                {t('settings')}
              </Button>
            </Link>
          )}
        </div>
      </Card>

      <div className="flex flex-col lg:flex-row w-full gap-3">
        <Card className="w-full lg:basis-1/5 h-fit lg:sticky lg:top-26 lg:self-start">
          <Link href="#about"><Button variant="secondary" className="w-full">{t('navProfile')}</Button></Link>
          {profile.offers_warranty && <Link href="#warranty"><Button variant="ghost" className="w-full">{t('navWarranty')}</Button></Link>}
          <Link href="#listings"><Button variant="ghost" className="w-full">{t('navListings')}</Button></Link>
          {isOwner && <Link href="#drafts"><Button variant="ghost" className="w-full">{t('navDrafts')}</Button></Link>}
          {isOwner && <Link href="#watchlist"><Button variant="ghost" className="w-full">{t('navWatchlist')}</Button></Link>}
        </Card>

        <div className="flex flex-col gap-3 w-full lg:basis-4/5">
          {profile.description && (
            <Card id="about" className="scroll-mt-26">
              <h3 className="text-lg font-semibold">{t('aboutTitle')}</h3>
              <TranslatableText text={profile.description} className="text-foreground whitespace-pre-wrap" />
            </Card>
          )}

          <Card>
            <h3 className="text-lg font-semibold">{t('contactInfoTitle')}</h3>
            {isOwner && me?.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted" />
                <span>{me.email}</span>
                <span className="text-xs text-muted">
                  {profile.show_email ? t('visibleToEveryone') : t('onlyVisibleToYou')}
                </span>
              </div>
            )}
            {!isOwner && profile.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted" />
                <span>{profile.email}</span>
              </div>
            )}
            {profile.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted" />
                <a href={phoneTelHref(profile.phone)} className="hover:text-primary-light">{formatPhoneNumber(profile.phone)}</a>
              </div>
            )}
            {fullAddress && (
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted mt-0.5 shrink-0" />
                <a
                  href={mapsSearchUrl(fullAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-light hover:underline"
                >
                  {fullAddress}
                </a>
              </div>
            )}
            {profile.website && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="w-4 h-4 text-muted" />
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-light hover:underline"
                >
                  {profile.website}
                </a>
              </div>
            )}
            {!profile.phone && !profile.website && !fullAddress && !(isOwner && me?.email) && !(!isOwner && profile.email) && (
              <p className="text-sm text-muted">{t('noContactInfo')}</p>
            )}
          </Card>

          {/* Warranty is dealer-only (see User.clean() on the backend,
              which forces offers_warranty back to false for anyone else),
              so profile.offers_warranty alone is enough to gate this --
              no separate is_dealer check needed. */}
          {profile.offers_warranty && (
            <Card id="warranty" className="scroll-mt-26">
              <h3 className="text-lg font-semibold">{t('warrantyTitle')}</h3>
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="w-4 h-4 text-success shrink-0" />
                <span className="font-medium">{profile.warranty_duration}</span>
              </div>
              {profile.warranty_description && (
                <p className="text-sm text-foreground whitespace-pre-wrap">{profile.warranty_description}</p>
              )}
            </Card>
          )}

          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{t('reviewsTitle')}</h3>
              <div className="flex items-center gap-3">
                {avgRating !== null && (
                  <div className="flex items-center gap-1 text-sm">
                    <Star className="w-4 h-4 fill-warning text-warning" />
                    <span className="font-medium">{avgRating.toFixed(1)}</span>
                    <span className="text-muted">({reviews.length})</span>
                  </div>
                )}
                {!isOwner && me && <LeaveReviewModal username={profile.username} />}
                {!isOwner && me && <ReportSellerModal username={profile.username} />}
              </div>
            </div>
            {reviews.length === 0 ? (
              <p className="text-sm text-muted">{t('noReviewsYet')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {reviews.map((review) => (
                  <div key={review.id} className="border-b border-border last:border-0 pb-3 last:pb-0">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={cn('w-3.5 h-3.5', i < review.rating ? 'fill-warning text-warning' : 'text-border')}
                        />
                      ))}
                      <span className="text-sm font-medium ml-2">@{review.reviewer_username}</span>
                      <span className="text-xs text-muted ml-1">· {formatTimeAgo(review.created_at, locale)}</span>
                    </div>
                    {review.comment && <p className="text-sm text-foreground mt-1">{review.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card id="listings" className="scroll-mt-26">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">{t('listingsTitle')}</h3>
              {isOwner && (
                <div className="flex items-center gap-2">
                  {profile.is_dealer && (
                    <Link href="/sell/bulk">
                      <Button variant="secondary" size="sm" className="flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        {t('bulkUpload')}
                      </Button>
                    </Link>
                  )}
                  <Link href="/sell">
                    <Button variant="primary" size="sm" className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      {t('sellACar')}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
            <ListingResultsGrid
              listings={listings}
              variant="v"
              columns={4}
              emptyMessage={t('noListingsYet')}
              currentUsername={me?.username}
            />
          </Card>

          {isOwner && (
            <Card id="drafts" className="scroll-mt-26">
              <h3 className="text-lg font-semibold">{t('draftsTitle')}</h3>
              <DraftsSection drafts={drafts} />
            </Card>
          )}

          {isOwner && (
            <Card id="watchlist" className="scroll-mt-26">
              <h3 className="text-lg font-semibold">{t('watchlistTitle')}</h3>
              <ListingResultsGrid
                listings={watchlist}
                variant="v"
                columns={4}
                emptyMessage={t('watchlistEmptyMessage')}
                currentUsername={me?.username}
                removeOnUnlike
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
