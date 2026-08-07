'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { ArrowRight, GitCompare } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useRouter } from '@/i18n/navigation'
import { addToCompareList, getCompareList, isInCompareList, removeFromCompareList } from '@/lib/compareList'
import { flyToCompareIcon } from '@/lib/flyToIcon'

interface CompareButtonProps {
  slug: string
}

export function CompareButton({ slug }: CompareButtonProps) {
  const t = useTranslations('CompareButton')
  const router = useRouter()
  const [inCompare, setInCompare] = useState(false)
  const [compareCount, setCompareCount] = useState(0)

  // Read after mount, not during render -- localStorage isn't available
  // during SSR and would otherwise mismatch the client's first render.
  useEffect(() => {
    setInCompare(isInCompareList(slug))
    setCompareCount(getCompareList().length)
  }, [slug])

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (inCompare) {
      removeFromCompareList(slug)
      setInCompare(false)
      setCompareCount((c) => c - 1)
      toast.success(t('removed'))
      return
    }

    addToCompareList(slug)
    setInCompare(true)
    setCompareCount((c) => c + 1)
    flyToCompareIcon(e.clientX, e.clientY)
    toast.success(t('added'), {
      action: { label: t('viewCompare'), onClick: () => router.push('/compare') },
    })
  }

  return (
    // A fragment, not a wrapping div -- this renders inside the parent's own
    // grid grid-cols-2 (alongside Print/Share/Report), so each button here
    // becomes its own grid cell and falls into place in that same 2-column
    // row-major order (View Compare lands under Share, not stacked under
    // Add to Compare in a cell of its own).
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleClick}
        className="w-full flex items-center justify-center gap-2 whitespace-nowrap print:hidden"
      >
        <GitCompare className="w-4 h-4 shrink-0" />
        {inCompare ? t('removeFromCompare') : t('addToCompare')}
      </Button>
      {/* Only worth showing once there's actually something to go look at --
          an empty /compare page isn't a useful destination. */}
      {compareCount > 0 && (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push('/compare')}
          className="w-full flex items-center justify-center gap-2 whitespace-nowrap print:hidden"
        >
          {t('viewCompare')}
          <ArrowRight className="w-4 h-4 shrink-0" />
        </Button>
      )}
    </>
  )
}
