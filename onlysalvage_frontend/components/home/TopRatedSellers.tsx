import { SellerCard } from '@/components/sellers/SellerCard'
import type { TopRatedSeller } from '@/lib/types'

interface TopRatedSellersProps {
  sellers: TopRatedSeller[]
  currentUsername?: string
}

export function TopRatedSellers({ sellers, currentUsername }: TopRatedSellersProps) {
  if (sellers.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {sellers.map((seller) => (
        <SellerCard key={seller.id} {...seller} currentUsername={currentUsername} />
      ))}
    </div>
  )
}
