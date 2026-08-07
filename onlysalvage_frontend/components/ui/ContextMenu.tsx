'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface ContextMenuItem {
  label: string
  icon?: React.ElementType
  onClick: () => void
  danger?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // mousedown (not click) so this fires before any onClick on the item
    // buttons themselves, and doesn't get confused with the contextmenu
    // event that opened this in the first place.
    const handlePointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  // Clamps so the menu never renders off the right/bottom edge of the
  // viewport -- it opens wherever the cursor right-clicked, which is
  // routinely close to an edge for cards near the end of a row/page.
  const style: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 200),
    top: Math.min(y, window.innerHeight - items.length * 36 - 16),
  }

  return (
    <div
      ref={ref}
      style={style}
      className="fixed z-50 min-w-[180px] bg-surface border border-border rounded-lg shadow-lg py-1 flex flex-col"
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          onClick={() => {
            item.onClick()
            onClose()
          }}
          className={cn(
            'flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors [@media(hover:hover)]:hover:bg-surface-raised',
            item.danger ? 'text-error' : 'text-foreground'
          )}
        >
          {item.icon && <item.icon className="w-4 h-4 shrink-0" />}
          {item.label}
        </button>
      ))}
    </div>
  )
}
