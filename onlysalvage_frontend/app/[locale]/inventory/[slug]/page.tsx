import { getTranslations, getLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import Image from 'next/image'
import type { Metadata } from 'next'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Price } from '@/components/ui/Price'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { InfoItem } from '@/components/ui/InfoItem'
import { CopyableVin } from '@/components/listing/CopyableVin'
import { TranslatableText } from '@/components/ui/TranslatableText'
import { PhotoGallery } from '@/components/listing/PhotoGallery'
import { ListingVideoEmbed } from '@/components/listing/ListingVideoEmbed'
import { RecentlyViewedTracker } from '@/components/listing/RecentlyViewedTracker'
import { ListingLikeButton } from '@/components/listing/ListingLikeButton'
import { PrintListingButton } from '@/components/listing/PrintListingButton'
import { ShareListingButton } from '@/components/listing/ShareListingButton'
import { ContactSellerCard } from '@/components/listing/ContactSellerCard'
import { ScheduleTestDriveModal } from '@/components/listing/ScheduleTestDriveModal'
import { ReportListingModal } from '@/components/listing/ReportListingModal'
import { CompareButton } from '@/components/listing/CompareButton'
import { RenewListingButton } from '@/components/listing/RenewListingButton'
import { ListingNavArrows } from '@/components/listing/ListingNavArrows'
import { ListingStatusButton } from '@/components/listing/ListingStatusButton'
import { PublishToggleButton } from '@/components/listing/PublishToggleButton'
import { DeleteListingButton } from '@/components/listing/DeleteListingButton'
import { ListingResultsGrid } from '@/components/listings/ListingResultsGrid'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { getMeServer, getListingServer, getSimilarListingsServer } from '@/lib/api-server'
import { getListingsBySeller } from '@/lib/api'
import { cn, colorSwatchIcon, formatAddress, formatMileage, formatTimeAgo, labelFor, mapsSearchUrl, safeImageUrl, sellerDisplayName } from '@/lib/utils'
import { vehicleOptionIcon } from '@/lib/vehicleOptionIcons'
import { SITE_URL } from '@/lib/seo'
import {
  VEHICLE_TYPES,
  TRANSMISSIONS,
  DRIVES,
  FUEL_TYPES,
  TITLE_DOCUMENTS,
  COLORS,
} from '@/lib/types'
import { Gauge, Fuel, FileText, Pencil, Star, Phone, MapPin, User, Flame, BadgeCheck, Barcode, CarFront, Eye, ArrowRight, Calendar } from 'lucide-react'
import { IconManualGearbox, IconSteeringWheel } from '@tabler/icons-react'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const listing = await getListingServer(slug)

  if (!listing) {
    return { title: 'Listing not found' }
  }

  const title = listing.title
  const priceText = listing.price != null ? `$${listing.price.toLocaleString()}` : 'Contact for price'
  const location = [listing.seller.city, listing.seller.state].filter(Boolean).join(', ')
  const description = [
    `${title} for sale${location ? ` in ${location}` : ''} -- ${priceText}`,
    listing.mileage != null ? `${listing.mileage.toLocaleString()} miles` : null,
    listing.description ? listing.description.slice(0, 120) : 'View photos, specs, and contact the seller on OnlySalvage.',
  ].filter(Boolean).join('. ')
  const firstImage = listing.images.find((img) => img.photo_type !== 'before_repair') ?? listing.images[0]
  const image = firstImage ? safeImageUrl(firstImage.large_url, firstImage.image_url) : undefined

  return {
    title,
    description,
    alternates: { canonical: `/inventory/${listing.slug}` },
    openGraph: {
      title,
      description,
      type: 'website',
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
    robots: listing.is_active
      ? { index: true, follow: true }
      : { index: false, follow: true },
  }
}

export default async function ListingDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const t = await getTranslations('ListingDetail')
  const tAttr = await getTranslations('VehicleAttributes')
  const tCommon = await getTranslations('Common')
  const locale = await getLocale()

  const statusLabel: Record<string, string> = { AV: t('statusAvailable'), PE: t('statusPending'), SO: t('statusSold') }
  const statusVariant: Record<string, 'success' | 'warning' | 'default'> = { AV: 'success', PE: 'warning', SO: 'default' }

  const [listing, me] = await Promise.all([
    getListingServer(slug),
    getMeServer(),
  ])

  if (!listing) {
    return (
      <div className="w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 gap-3 flex flex-col">
        <Card className="items-center">
          <h1 className="text-2xl">{t('listingNotFound')}</h1>
          <p className="text-muted">{t('listingNotFoundDescription', { slug })}</p>
        </Card>
      </div>
    )
  }

  const isOwner = me?.username === listing.seller.username
  // Exact street address is dealer-only -- the backend already clears it for
  // everyone else, but this keeps the page honest even against stale data.
  const sellerAddress = formatAddress(listing.seller.is_dealer ? listing.seller : { ...listing.seller, street_address: undefined })

  const galleryImages = listing.images.filter((img) => img.photo_type !== 'before_repair')
  const beforeRepairImages = listing.images.filter((img) => img.photo_type === 'before_repair')

  const [similarListings, sellerListingsRaw] = await Promise.all([
    getSimilarListingsServer(listing.slug, 4),
    getListingsBySeller(listing.seller.id),
  ])
  const moreFromSellerAll = sellerListingsRaw.filter((l) => l.id !== listing.id && l.status !== 'SO')
  const moreFromSeller = moreFromSellerAll.slice(0, 4)
  const hasMoreFromSeller = moreFromSellerAll.length > moreFromSeller.length

  // listing.status can only actually be 'DR' here if the owner navigates
  // straight to a draft's detail page by URL (see Listing.status on
  // lib/types.ts) -- not a path anything in the UI links to, but the cast
  // keeps this an honest lookup (undefined) instead of a type error.
  const availability = ({
    AV: 'https://schema.org/InStock',
    PE: 'https://schema.org/PreOrder',
    SO: 'https://schema.org/SoldOut',
  } as Record<string, string>)[listing.status]

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Car',
    name: listing.title,
    image: galleryImages.map((img) => safeImageUrl(img.large_url, img.image_url)),
    description: listing.description || listing.title,
    brand: { '@type': 'Brand', name: listing.make.name },
    model: listing.model.name,
    vehicleModelDate: String(listing.year),
    vehicleIdentificationNumber: listing.vin,
    mileageFromOdometer: listing.mileage != null
      ? { '@type': 'QuantitativeValue', value: listing.mileage, unitCode: 'SMI' }
      : undefined,
    vehicleTransmission: listing.transmission,
    fuelType: listing.fuel_type,
    color: listing.exterior_color || undefined,
    offers: {
      '@type': 'Offer',
      price: listing.price ?? undefined,
      priceCurrency: 'USD',
      availability,
      itemCondition: 'https://schema.org/UsedCondition',
      url: `${SITE_URL}/inventory/${listing.slug}`,
      seller: {
        '@type': listing.seller.is_dealer ? 'AutoDealer' : 'Person',
        name: sellerDisplayName(listing.seller),
      },
    },
  }

  const breadcrumbItems = [
    { label: t('breadcrumbHome'), href: '/' },
    { label: t('breadcrumbInventory'), href: '/inventory' },
    { label: listing.title },
  ]

  return (
    <div className="w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 mb-6 gap-3 flex flex-col print:px-0 print:mt-0 print:mb-0 print:gap-3 print:max-w-none">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <BreadcrumbJsonLd items={breadcrumbItems} />
      <RecentlyViewedTracker slug={listing.slug} title={listing.title} />
      <Card className="print:hidden">
        <Breadcrumb items={breadcrumbItems} />
      </Card>

      <div className="flex w-full gap-3 flex-col lg:flex-row print:flex-col print:gap-3">
        <div className="flex flex-col gap-3 basis-2/3 min-w-0 print:gap-3">
          <Card className="p-0 overflow-hidden gap-0 min-w-0 print:break-inside-avoid">
            <PhotoGallery
              images={galleryImages}
              title={listing.title}
              statusBadge={
                listing.is_active
                  ? { label: statusLabel[listing.status], variant: statusVariant[listing.status] }
                  : { label: t('statusInactive'), variant: 'error' }
              }
            />
          </Card>

          <Card className="print:p-4 print:break-inside-avoid">
            <h3 className="text-lg font-semibold">{t('vehicleDetails')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 print:grid-cols-2 print:gap-2">
              {/* <InfoItem label={t('year')} value={String(listing.year)} /> */}
              {/* <InfoItem label={t('make')} value={listing.make.name} /> */}
              {/* <InfoItem label={t('model')} value={listing.model.name} /> */}
              {/* {listing.trim && <InfoItem label={t('trim')} value={listing.trim} />} */}
              <InfoItem icon={CarFront} label={t('type')} value={labelFor(VEHICLE_TYPES, listing.vehicle_type, (code) => tAttr(`vehicleType.${code}`))} />
              <CopyableVin icon={<Barcode className="w-4 h-4 text-muted shrink-0" />} label={t('vin')} vin={listing.vin} />
              {listing.mileage != null && <InfoItem icon={Gauge} label={t('mileage')} value={formatMileage(listing.mileage, locale)} />}
              <InfoItem icon={IconManualGearbox} label={t('transmission')} value={labelFor(TRANSMISSIONS, listing.transmission, (code) => tAttr(`transmission.${code}`))} />
              <InfoItem icon={IconSteeringWheel} label={t('drivetrain')} value={labelFor(DRIVES, listing.drive, (code) => tAttr(`drive.${code}`))} />
              <InfoItem icon={Fuel} label={t('fuelType')} value={labelFor(FUEL_TYPES, listing.fuel_type, (code) => tAttr(`fuelType.${code}`))} />
              {listing.engine && <InfoItem icon={Flame} label={t('engine')} value={listing.engine} />}
              {listing.exterior_color && <InfoItem icon={colorSwatchIcon(listing.exterior_color)} label={t('exterior')} value={labelFor(COLORS, listing.exterior_color, (code) => tAttr(`color.${code}`))} />}
              {listing.interior_color && <InfoItem icon={colorSwatchIcon(listing.interior_color)} label={t('interior')} value={labelFor(COLORS, listing.interior_color, (code) => tAttr(`color.${code}`))} />}
              <InfoItem icon={FileText} label={t('titleStatus')} value={labelFor(TITLE_DOCUMENTS, listing.title_document, (code) => tAttr(`titleDocument.${code}`))} />
              {listing.owners != null && <InfoItem icon={User} label={t('owners')} value={String(listing.owners)} />}
              <InfoItem icon={Calendar} label={t('posted')} value={formatTimeAgo(listing.created_at, locale, { withPrefix: false })} />
            </div>
            {(listing.carfax_pdf || listing.alignment_report || listing.inspection_report) && (
              <div className="flex flex-col gap-2 print:hidden">
                {listing.carfax_pdf && (
                  <a
                    href={listing.carfax_pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary-light hover:text-primary-hover font-medium text-sm w-fit"
                  >
                    <FileText className="w-4 h-4" />
                    {t('viewCarfaxReport')}
                  </a>
                )}
                {listing.alignment_report && (
                  <a
                    href={listing.alignment_report}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary-light hover:text-primary-hover font-medium text-sm w-fit"
                  >
                    <FileText className="w-4 h-4" />
                    {t('viewAlignmentReport')}
                  </a>
                )}
                {listing.inspection_report && (
                  <a
                    href={listing.inspection_report}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-primary-light hover:text-primary-hover font-medium text-sm w-fit"
                  >
                    <FileText className="w-4 h-4" />
                    {t('viewInspectionReport')}
                  </a>
                )}
              </div>
            )}
          </Card>

          {(listing.city_mpg != null || listing.hwy_mpg != null) && (
            <Card className="print:p-4 print:break-inside-avoid">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Fuel className="w-5 h-5 text-primary" />
                {t('mpg')}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {listing.city_mpg != null && (
                  <div className="flex flex-col items-center text-center gap-1 rounded-lg bg-surface-raised py-4 print:bg-transparent">
                    <span className="text-3xl font-bold text-foreground">{listing.city_mpg}</span>
                    <span className="text-xs text-muted">{t('cityMpgLabel')}</span>
                  </div>
                )}
                {listing.hwy_mpg != null && (
                  <div className="flex flex-col items-center text-center gap-1 rounded-lg bg-surface-raised py-4 print:bg-transparent">
                    <span className="text-3xl font-bold text-foreground">{listing.hwy_mpg}</span>
                    <span className="text-xs text-muted">{t('hwyMpgLabel')}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {beforeRepairImages.length > 0 && (
            <Card className="print:hidden">
              <h3 className="text-lg font-semibold">{t('beforeRepairPhotos')}</h3>
              <p className="text-sm text-muted -mt-1">{t('beforeRepairPhotosDescription')}</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {beforeRepairImages.map((img) => (
                  <a
                    key={img.id}
                    href={safeImageUrl(img.image_url, img.large_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative aspect-square rounded-lg overflow-hidden border border-border block"
                  >
                    <Image
                      src={safeImageUrl(img.thumb_url, img.image_url)}
                      alt={t('beforeRepairPhotoAlt')}
                      fill
                      sizes="(min-width: 1024px) 11vw, (min-width: 768px) 16vw, (min-width: 640px) 25vw, 33vw"
                      className="object-cover"
                    />
                  </a>
                ))}
              </div>
            </Card>
          )}

          {listing.options.length > 0 && (
            <Card className="print:hidden">
              <h3 className="text-lg font-semibold">{t('featuresAndOptions')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                {listing.options.map((opt) => {
                  const OptionIcon = vehicleOptionIcon(opt.icon)
                  return (
                    <div key={opt.id} className="flex items-center gap-2 text-sm text-foreground">
                      <OptionIcon className="w-4 h-4 text-success shrink-0" />
                      {opt.label}
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          <Card className="print:p-4 print:break-inside-avoid">
            <h3 className="text-lg font-semibold">{t('description')}</h3>
            {listing.description ? (
              <TranslatableText text={listing.description} className="text-foreground whitespace-pre-wrap" />
            ) : (
              <p><span className="text-muted">{t('noDescriptionProvided')}</span></p>
            )}
          </Card>

          {listing.video_url && (
            <Card className="print:hidden">
              <h3 className="text-lg font-semibold">{t('videoTitle')}</h3>
              <ListingVideoEmbed url={listing.video_url} watchLabel={t('watchVideo')} />
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-3 basis-1/3 h-fit print:basis-auto">
          <Card className="print:p-4 print:break-inside-avoid">
            <h1 className="text-xl font-semibold">{listing.title}</h1>
            <div className="flex items-center justify-between gap-2">
              <Price value={listing.price ?? undefined} />
              <ListingLikeButton
                listingId={listing.id}
                initialLiked={listing.is_liked}
                initialLikesCount={listing.likes_count}
              />
            </div>
            <div className="flex items-center justify-between gap-2 print:hidden">
              <span className="flex items-center gap-1 text-xs text-muted">
                <Eye className="w-3.5 h-3.5" />
                {t('viewsCount', { count: listing.views_count })}
              </span>
              <span className="text-xs text-muted">{formatTimeAgo(listing.created_at, locale)}</span>
            </div>
            {isOwner && (
              <span className="flex items-center gap-1 text-xs text-muted print:hidden">
                <Phone className="w-3.5 h-3.5" />
                {t('callsReceived', { count: listing.call_count })}
              </span>
            )}
          </Card>

          <Card className="print:hidden">
            <h3 className="text-lg font-semibold">{t('actionsTitle')}</h3>
            <div className="grid grid-cols-2 gap-2">
              <PrintListingButton />
              <ShareListingButton title={listing.title} />
              <CompareButton slug={listing.slug} />
              {!isOwner && listing.status !== 'SO' && <ScheduleTestDriveModal slug={listing.slug} />}
              {!isOwner && me && <ReportListingModal slug={listing.slug} />}
            </div>

            {isOwner && (
              <div className="flex flex-col gap-2 pt-2 mt-1 border-t border-border">
                <Link href={`/inventory/${listing.slug}/edit`}>
                  <Button variant="secondary" size="sm" className="w-full flex items-center justify-center gap-2">
                    <Pencil className="w-4 h-4" />
                    {t('editListing')}
                  </Button>
                </Link>
                <div className="grid grid-cols-2 gap-2">
                  {listing.status === 'AV' && (
                    <>
                      <ListingStatusButton slug={listing.slug} status="PE" label={t('markPending')} />
                      <ListingStatusButton slug={listing.slug} status="SO" label={t('markSold')} />
                    </>
                  )}
                  {listing.status === 'PE' && (
                    <>
                      <ListingStatusButton slug={listing.slug} status="AV" label={t('markAvailable')} />
                      <ListingStatusButton slug={listing.slug} status="SO" label={t('markSold')} />
                    </>
                  )}
                  {listing.status === 'SO' && (
                    <ListingStatusButton slug={listing.slug} status="AV" label={t('markAvailable')} />
                  )}
                  <PublishToggleButton slug={listing.slug} isActive={listing.is_active} />
                  <DeleteListingButton slug={listing.slug} sellerUsername={listing.seller.username} />
                </div>
                {listing.status === 'AV' && (
                  <RenewListingButton
                    slug={listing.slug}
                    canRenew={listing.can_renew}
                    renewalAvailableAt={listing.renewal_available_at}
                    renewalCount={listing.renewal_count}
                  />
                )}
              </div>
            )}
          </Card>

          <Card className="print:p-4 print:break-inside-avoid">
            <h3 className="text-lg font-semibold">{t('seller')}</h3>
            <Link href={`/profile/${listing.seller.username}`} className="flex items-center gap-3">
              <Avatar
                src={listing.seller.profile_picture ?? undefined}
                name={sellerDisplayName(listing.seller)}
                size="md"
              />
              <div>
                <p className="flex items-center gap-1 font-medium text-foreground">
                  {sellerDisplayName(listing.seller)}
                  {listing.seller.is_verified && (
                    <span title={t('verifiedSeller')}>
                      <BadgeCheck className="w-4 h-4 text-primary-light shrink-0" aria-label={t('verifiedSeller')} />
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted">@{listing.seller.username}</p>
              </div>
            </Link>
            {sellerAddress && (
              <p className="flex items-start gap-1.5 text-sm text-muted mt-1">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                <a
                  href={mapsSearchUrl(sellerAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary-light hover:underline"
                >
                  {sellerAddress}
                </a>
              </p>
            )}
          </Card>

          {!isOwner && (
            <ContactSellerCard
              listingId={listing.id}
              hasPhone={!!listing.seller.has_phone}
              phoneAreaCode={listing.seller.phone_area_code}
              email={listing.seller.email}
            />
          )}

          {moreFromSeller.length > 0 && (
            <Card className="print:hidden">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">{t('moreFromThisSeller')}</h3>
                {hasMoreFromSeller && (
                  <Link
                    href={`/profile/${listing.seller.username}#listings`}
                    className="flex items-center gap-1 text-sm font-medium text-primary-light hover:text-primary-hover transition-colors shrink-0"
                  >
                    {tCommon('viewAll')}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </div>
              <ListingResultsGrid listings={moreFromSeller} variant="v" columns={2} currentUsername={me?.username} />
            </Card>
          )}
        </div>
      </div>

      <ListingNavArrows slug={listing.slug} />

      {similarListings.length > 0 && (
        <Card className="print:hidden">
          <SectionHeader title={t('similarListings')} subtitle={t('similarListingsSubtitle')} viewAllHref="/inventory" />
          <ListingResultsGrid listings={similarListings} variant="v" columns={4} currentUsername={me?.username} />
        </Card>
      )}
    </div>
  )
}
