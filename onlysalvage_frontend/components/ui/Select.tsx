'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  label?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: SelectOption[]
  placeholder?: string
  error?: string
  disabled?: boolean
  className?: string
  // Pinned below the option list (outside the scrollable area) -- e.g. a
  // "Request a new make" action. Doesn't select a value; just closes the
  // dropdown and runs onFooterClick.
  footerLabel?: string
  onFooterClick?: () => void
}

export function Select({ label, value, onChange, options, placeholder, error, disabled, className, footerLabel, onFooterClick }: SelectProps) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typeaheadRef = useRef({ buffer: '', lastTime: 0 })
  // Suppresses hover-driven highlighting right after a keyboard move -- when
  // scrollIntoView shifts the list under a stationary cursor, browsers refire
  // mouseenter on whatever option ends up there, which would otherwise stomp
  // on the keyboard/typeahead selection the user actually just made.
  const suppressHoverRef = useRef(false)

  const items: SelectOption[] = placeholder ? [{ value: '', label: placeholder }, ...options] : options
  const currentValue = value ?? ''
  const selectedIndex = items.findIndex(item => item.value === currentValue)
  const selected = selectedIndex >= 0 ? items[selectedIndex] : undefined
  const isPlaceholderSelected = placeholder ? selectedIndex === 0 : false

  const commit = (val: string) => {
    onChange?.({ target: { value: val } } as React.ChangeEvent<HTMLSelectElement>)
    setOpen(false)
  }

  const moveHighlight = (next: number | ((i: number) => number)) => {
    suppressHoverRef.current = true
    setHighlighted(next)
  }

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  useEffect(() => {
    if (open) {
      moveHighlight(selectedIndex >= 0 ? selectedIndex : 0)
    }
    // Only re-sync the highlighted index when the panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[highlighted] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [open, highlighted])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return

    // Type-to-jump, mirroring the native <select>: typing letters/numbers
    // jumps to (or, while open, highlights) the next option whose label
    // starts with what's been typed so far. The buffer resets after a short
    // pause so e.g. typing "ford" then pausing then typing "gmc" searches
    // for "gmc" rather than "fordgmc".
    if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now()
      const state = typeaheadRef.current
      state.buffer = now - state.lastTime > 800 ? e.key : state.buffer + e.key
      state.lastTime = now

      const query = state.buffer.toLowerCase()
      const match = items.findIndex(item => item.label.toLowerCase().startsWith(query))
      if (match >= 0) {
        e.preventDefault()
        if (open) {
          moveHighlight(match)
        } else {
          commit(items[match].value)
        }
      }
      return
    }

    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }

    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveHighlight(i => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveHighlight(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const item = items[highlighted]
      if (item) commit(item.value)
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className="flex flex-col gap-1 w-full" ref={containerRef}>
      {label && <label className="text-sm text-foreground">{label}</label>}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'w-full flex items-center justify-between gap-2 bg-surface border rounded-md px-3 py-2 text-left text-foreground outline-none transition-colors cursor-pointer',
            'focus:border-primary',
            error ? 'border-error' : 'border-border',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
        >
          <span className={cn('truncate', (!selected || isPlaceholderSelected) && 'text-muted')}>
            {selected ? selected.label : placeholder || ''}
          </span>
          <ChevronDown className={cn('w-4 h-4 text-muted shrink-0 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-surface shadow-lg overflow-hidden">
            <ul
              ref={listRef}
              role="listbox"
              onMouseMove={() => { suppressHoverRef.current = false }}
              className="max-h-60 overflow-y-auto py-1"
            >
              {items.map((item, i) => (
                <li
                  key={item.value || '__placeholder__'}
                  role="option"
                  aria-selected={item.value === currentValue}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => { if (!suppressHoverRef.current) setHighlighted(i) }}
                  onClick={() => commit(item.value)}
                  className={cn(
                    'flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer',
                    item.value === '' ? 'text-muted' : 'text-foreground',
                    i === highlighted && 'bg-surface-raised'
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  {item.value === currentValue && <Check className="w-4 h-4 text-primary-light shrink-0" />}
                </li>
              ))}
            </ul>
            {footerLabel && onFooterClick && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setOpen(false); onFooterClick() }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary-light border-t border-border hover:bg-surface-raised cursor-pointer"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="truncate">{footerLabel}</span>
              </button>
            )}
          </div>
        )}
      </div>
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  )
}
