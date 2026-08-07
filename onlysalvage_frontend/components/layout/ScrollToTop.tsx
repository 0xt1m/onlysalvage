'use client'

import { useEffect } from 'react'
import { usePathname } from '@/i18n/navigation'

// Next's own scroll-to-top-on-navigation doesn't reliably fire for every
// client-side transition in this app (e.g. clicking into a listing from a
// results grid) -- this is the standard, defensive fix: force it explicitly
// on every route change instead of relying on the framework default.
// Keyed on pathname only, not search params, so in-page filter/query
// changes (which already manage their own scroll position where it
// matters -- see InventoryBrowser) aren't affected.
export function ScrollToTop() {
  const pathname = usePathname()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
