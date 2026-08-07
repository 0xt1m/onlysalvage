import { SITE_URL } from '@/lib/seo'

interface BreadcrumbJsonLdItem {
  label: string
  href?: string
}

// Renders the same breadcrumb trail already shown by <Breadcrumb> as
// schema.org BreadcrumbList JSON-LD, so Google can show the trail under the
// search result instead of the raw URL. The last item is usually the current
// page and has no href -- schema.org only requires `name`/`position` per
// ListItem, so `item` is simply omitted for it rather than guessed at.
export function BreadcrumbJsonLd({ items }: { items: BreadcrumbJsonLdItem[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_URL}${item.href}` } : {}),
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
    />
  )
}
