'use client'

import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={cn('animate-spin', sizes[size], className)}
    >
      <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border)" strokeWidth="8" />
      <circle cx="50" cy="50" r="42" fill="none" stroke="var(--accent)" strokeWidth="8" strokeDasharray="66 198" strokeLinecap="round" />
    </svg>
  )
}