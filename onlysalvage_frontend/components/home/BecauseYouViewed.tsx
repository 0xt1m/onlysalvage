"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ListingResultsGrid } from "@/components/listings/ListingResultsGrid";
import { useAuth } from "@/lib/auth-context";
import { getSimilarListings } from "@/lib/api";
import { getRecentlyViewed } from "@/lib/recentlyViewed";
import type { ListingSummary } from "@/lib/types";

// Fallback recommendation section for visitors with no tracked search/view
// history yet (or who aren't logged in) -- reuses the same "similar
// listings" endpoint as the listing detail page, seeded from the most
// recently viewed listing in this browser's localStorage.
export function BecauseYouViewed() {
  const t = useTranslations("Home");
  const { user } = useAuth();
  const [viewedTitle, setViewedTitle] = useState<string | null>(null);
  const [listings, setListings] = useState<ListingSummary[] | null>(null);

  useEffect(() => {
    const [mostRecent] = getRecentlyViewed();
    if (!mostRecent) return;
    setViewedTitle(mostRecent.title);
    getSimilarListings(mostRecent.slug, 4).then(setListings);
  }, []);

  if (!viewedTitle || !listings || listings.length === 0) return null;

  return (
    <Card>
      <SectionHeader
        title={t("becauseYouViewedTitle", { title: viewedTitle })}
        subtitle={t("becauseYouViewedSubtitle")}
        viewAllHref="/inventory"
      />
      <ListingResultsGrid listings={listings} variant="v" columns={4} currentUsername={user?.username} />
    </Card>
  );
}
