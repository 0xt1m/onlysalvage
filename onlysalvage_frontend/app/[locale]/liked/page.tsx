import { Card } from '@/components/ui/Card';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ListingResultsGrid } from '@/components/listings/ListingResultsGrid';
import { LocalWatchlist } from '@/components/listing/LocalWatchlist';
import { getMeServer, getListingsServer } from '@/lib/api-server';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from "next";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Watchlist",
};

export default async function LikedPage() {
  const me = await getMeServer();
  // Sold listings stay on the watchlist (not excluded) -- ListingCard already
  // marks them clearly with a Sold badge and dims them, so there's no need
  // to hide them; a buyer may still want the record of what they were
  // tracking. is_active=true is still the default in getListingsServer, so a
  // paused (not sold) listing is the one case still hidden here.
  const { results } = me ? await getListingsServer({ liked: 'true' }) : { results: [] };
  const t = await getTranslations('Liked');

  return (
    <div className='w-full bg-background max-w-[1600px] mx-auto px-4 xs:px-5 sm:px-6 mt-3 mb-6 gap-3 flex flex-col'>
      <Card>
        <Breadcrumb items={[{ label: t('breadcrumbHome'), href: "/" }, { label: t('breadcrumbWatchlist') }]} />
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
      </Card>

      <Card>
        {me ? (
          <ListingResultsGrid
            listings={results}
            variant="v"
            emptyMessage={t('emptyMessage')}
            currentUsername={me.username}
            removeOnUnlike
          />
        ) : (
          <LocalWatchlist />
        )}
      </Card>
    </div>
  );
}
