'use client'

import { Copy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

interface CopyableVinProps {
  // A rendered element (e.g. <Barcode className="..." />), not the component
  // type itself -- Client Components can only receive already-serialized
  // props from a Server Component parent, and a bare component reference
  // (a function/object with $$typeof) isn't one of those, unlike a JSX
  // element, which is just a plain object.
  icon?: React.ReactNode
  label: string
  vin: string
}

// Same visual shape as InfoItem, plus an inline copy button -- VIN is the
// one field on this page people actually need to paste elsewhere (a VIN
// decoder, a report lookup, etc.), so it gets its own component rather than
// a generic slot added to InfoItem for a single use case.
export function CopyableVin({ icon, label, vin }: CopyableVinProps) {
  const t = useTranslations('ListingDetail')

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(vin)
      toast.success(t('vinCopied'))
    } catch {
      toast.error(t('vinCopyFailed'))
    }
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted min-w-0">
      {icon}
      <span className="font-medium shrink-0">{label}:</span>
      <span className="text-foreground truncate min-w-0">{vin}</span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={t('copyVin')}
        className="shrink-0 text-muted hover:text-foreground transition-colors cursor-pointer print:hidden"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
