"use client";

import { useEffect } from "react";
import { addRecentlyViewed } from "@/lib/recentlyViewed";

export function RecentlyViewedTracker({ slug, title }: { slug: string; title: string }) {
  useEffect(() => {
    addRecentlyViewed({ slug, title });
  }, [slug, title]);

  return null;
}
