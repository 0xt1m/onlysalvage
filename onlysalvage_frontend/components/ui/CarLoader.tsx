'use client'

import { Car } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CarLoaderProps {
  // 'sm' for a thin strip; 'md'/'lg' for a standalone loading state inside
  // page content (e.g. InventoryBrowser's own results-loading state).
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const TRACK_HEIGHT: Record<NonNullable<CarLoaderProps['size']>, string> = {
  sm: 'h-4',
  md: 'h-10',
  lg: 'h-14',
}

const CAR_SIZE: Record<NonNullable<CarLoaderProps['size']>, string> = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-11 h-11',
}

// The drive-then-crash motion itself lives in globals.css (.car-loader-*)
// since it needs several keyframe stops (idle bounce, then squash/rotate on
// impact) split across two layers -- see the comment there for why.
export function CarLoader({ size = 'md', className }: CarLoaderProps) {
  return (
    <div className={cn('relative w-full overflow-hidden', TRACK_HEIGHT[size], className)} aria-hidden="true">
      {/* Dashed center line -- purely decorative, just gives the strip a
          "road" reading instead of empty space the car floats across. */}
      <div
        className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 opacity-50"
        style={{ backgroundImage: 'repeating-linear-gradient(to right, var(--border) 0 10px, transparent 10px 20px)' }}
      />

      <div className="car-loader-track absolute top-1/2 -translate-y-1/2">
        <Car className={cn('car-loader-body text-accent', CAR_SIZE[size])} />
      </div>

      {/* Impact sparks -- invisible almost the entire loop, only popping
          for a beat right as the car above reaches the wall. */}
      <div className="absolute right-[5%] top-1/2 -translate-y-1/2 flex items-center gap-1">
        <span className="car-loader-spark block w-1.5 h-1.5 rounded-full bg-warning" style={{ animationDelay: '0s' }} />
        <span className="car-loader-spark block w-1 h-1 rounded-full bg-accent" style={{ animationDelay: '0.08s' }} />
        <span className="car-loader-spark block w-1 h-1 rounded-full bg-warning" style={{ animationDelay: '0.15s' }} />
      </div>
    </div>
  )
}
