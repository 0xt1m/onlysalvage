'use client'

import { useState, type ElementType } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

import { Checkbox } from '@/components/ui/Checkbox';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';

// Buckets `items` by `groupFor(item)`, merging every occurrence of a label
// into one group (not just adjacent ones) while keeping each group's
// position at wherever its label first appeared -- so as long as the
// caller's `items` array is already roughly sorted by group (e.g. models
// sorted by make name), groups come out in that same order without the
// caller having to pre-bucket them itself.
function groupItems(items: string[], groupFor: (item: string) => string) {
  const map = new Map<string, string[]>()
  for (const item of items) {
    const label = groupFor(item)
    if (!map.has(label)) map.set(label, [])
    map.get(label)!.push(item)
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }))
}

interface FilterDropdownProps {
  title: string
  // Leading icon next to the title itself (distinct from `iconFor`, which is
  // per-item) -- purely visual, doesn't affect what's submitted.
  icon?: ElementType
  items: string[]
  isOpen?: Boolean
  maxHeight?: number
  showApplyButton?: Boolean
  onApply: (selected: string[]) => void
  defaultSelected?: string[]
  className?: string
  // Items double as the exact value sent to the backend (e.g. the filter
  // query param), which for several filters must stay the canonical English
  // text. This lets the checkbox label (and search matching) show a
  // translated string without changing what's actually submitted.
  labelFor?: (item: string) => string
  // Optional leading icon per item (e.g. a color swatch) -- purely visual,
  // doesn't affect what's submitted.
  iconFor?: (item: string) => ElementType | undefined
  // Splits the list into labeled sub-groups (e.g. Model's items grouped by
  // Make once more than one Make is checked) -- purely a display grouping,
  // doesn't change what's submitted or how selection/search work. Omitted
  // (the default), or when every item resolves to the same group, renders
  // as one plain flat list with no headers.
  groupFor?: (item: string) => string
  // For a filter that only makes sense once another one has a selection
  // (e.g. Model needs a Make first) -- stays visually expanded at its usual
  // height rather than collapsing, so the layout around it doesn't jump, but
  // shows `disabledMessage` in place of the search/checkbox list and blocks
  // interaction.
  disabled?: boolean
  disabledMessage?: string
  // Shows a spinner in place of the item list (e.g. while Model's options
  // are being re-fetched after a Make changes) without collapsing the
  // dropdown or blocking it the way `disabled` does -- the search input
  // and Apply button stay interactive-looking but inert until it clears.
  loading?: boolean
  // Controlled open state, for accordion-style groups where a parent needs
  // to force every sibling closed as soon as one of them opens. Uncontrolled
  // (the default) when omitted -- each instance just manages its own.
  open?: boolean
  onOpenChange?: (open: boolean) => void
  // 2 or 3 for a multi-up grid of options (e.g. colors, where each row is
  // short enough that a single column wastes width) -- 1 (the default) keeps
  // the usual single-column stacked list.
  columns?: 1 | 2 | 3
  // Stretches this dropdown to fill its parent's full height (ignoring
  // `maxHeight`) instead of sizing to its own content -- for when a parent
  // wants several dropdowns to evenly split a shared column's height (e.g.
  // Make/Model each taking half), rather than each just being as tall as
  // its own item list demands. Only takes effect at the lg breakpoint --
  // the parent column that provides the height to fill only exists on
  // desktop (the mobile drawer is a single naturally-stacked column), so
  // below lg this still respects `maxHeight` like any other dropdown rather
  // than growing to its full, potentially huge (e.g. 50+ makes) item list.
  fillHeight?: boolean
  // Passed straight through to each item's Checkbox -- e.g. a smaller size
  // for a dense multi-column grid (colors) where the default reads too big.
  itemLabelClassName?: string
  // Passed straight through to each item's Checkbox root -- e.g. a tighter
  // row height (overriding the default py-2) for a filter with a lot of
  // options stacked in a compact sidebar.
  itemClassName?: string
  // Hides the search input entirely -- worth doing for a short, fixed list
  // (e.g. drive type, seller) where searching adds nothing but clutter.
  // Selection/search-matching logic is untouched either way, since `search`
  // just never leaves "" when this is off.
  showSearch?: boolean
}

export function FilterDropdown({ title, icon: Icon, items, isOpen=false, maxHeight=28, showApplyButton = true, onApply, defaultSelected = [], className, labelFor, iconFor, groupFor, disabled = false, disabledMessage, loading = false, open: controlledOpen, onOpenChange, columns = 1, fillHeight = false, itemLabelClassName, itemClassName, showSearch = true }: FilterDropdownProps) {
  const t = useTranslations('Filters')
  const [internalOpen, setInternalOpen] = useState(isOpen || defaultSelected.length > 0)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next)
    else setInternalOpen(next)
  }
  const [selected, setSelected] = useState<string[]>(defaultSelected)
  const [search, setSearch] = useState('')
  // Checkbox tracks its own checked state internally (defaultChecked is
  // only read once, at mount) -- clearing `selected` here wouldn't be
  // enough on its own to visually uncheck already-mounted boxes, so this
  // bumps to force every Checkbox below to remount (see their `key`s) and
  // pick the cleared state back up as a fresh defaultChecked=false.
  const [clearCount, setClearCount] = useState(0)
  const expanded = disabled || open

  const displayLabel = (item: string) => labelFor?.(item) ?? item

  const filtered = items.filter(item =>
    displayLabel(item).toLowerCase().includes(search.toLowerCase())
  )

  function toggleItem(item: string) {
    const next = selected.includes(item) ? selected.filter(i => i !== item) : [...selected, item]
    setSelected(next)
    // With no Apply button of its own, this widget has no other way to
    // report a change -- it fires live instead, on every toggle, rather
    // than only once a button is clicked. Called after setSelected (not from
    // inside its updater) since updater functions run during React's render
    // phase, where calling a parent's setState is unsafe.
    if (!showApplyButton) onApply(next)
  }

  function clearAll() {
    setSelected([])
    setClearCount((c) => c + 1)
    if (!showApplyButton) onApply([])
  }

  return (
    <Card
      className={cn('select-none p-3 min-w-0', fillHeight && 'lg:h-full lg:min-h-0 lg:flex-1', disabled && 'opacity-50', !disabled && !expanded && 'cursor-pointer', className)}
      onClick={() => { if (!disabled && !expanded) setOpen(true) }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); if (!disabled) setOpen(!open) }}
        aria-disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between gap-2 select-none min-w-0',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
          fillHeight && 'shrink-0'
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-muted shrink-0" />}
          <span className="text-foreground font-medium truncate min-w-0">{title}</span>
        </span>
        <svg
          className={cn('w-4 h-4 shrink-0 transition-transform duration-200', expanded && 'rotate-180')}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* CSS Grid's fr unit can be transitioned, which lets this animate
          to/from the content's natural height without knowing it up front --
          unlike animating max-height, which either clips a tall list short
          or makes a short one look like it's easing at the wrong speed.
          `inert` keeps the collapsed content out of tab order/screen readers
          even though it's still technically in the DOM (needed so it's
          there to animate open, rather than popping in unstyled). */}
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          fillHeight && 'lg:flex-1 lg:min-h-0'
        )}
        inert={!expanded || disabled}
      >
        <div className={cn('overflow-hidden', fillHeight && 'lg:h-full')}>
          <div className={cn('flex flex-col gap-3 pt-1.5', fillHeight && 'lg:h-full')}>
            {showSearch && (
              <Input
                placeholder={t('search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={disabled || loading}
                className='rounded-md px-3 py-1.5 text-sm'
                suffix={selected.length > 0 && (
                  <span className="relative group inline-flex">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); clearAll() }}
                      className="flex items-center justify-center p-1 rounded text-muted hover:text-error hover:bg-surface-raised transition-colors"
                      aria-label={t('deselectAll')}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    {/* Custom hover tooltip, not the native `title` attribute
                        -- browsers stall a native title tooltip ~1s before
                        showing it, which reads as sluggish next to the rest
                        of the UI's instant hover feedback. right-0 (not
                        centered) keeps it from overflowing the input's right
                        edge, same reasoning as the Edit icon tooltips on
                        AddressAutocomplete/CityAutocomplete. */}
                    <span className="pointer-events-none absolute right-0 bottom-full mb-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                      {t('deselectAll')}
                    </span>
                  </span>
                )}
              />
            )}

            {/* The height/max-height cap below is a CSS custom property
                (`--fd-h`), not a plain inline style value, specifically so
                fillHeight's lg:h-auto/lg:max-h-none can cancel it in a
                media query -- an inline style always wins over a stylesheet
                rule regardless of breakpoint, so a real Tailwind class is
                the only way to have this cap apply on mobile but not
                desktop. Without it, fillHeight (Make/Model) had no cap at
                all below lg, since the parent column that's supposed to
                bound its height only exists on desktop -- on mobile that
                let the list grow to its full, sometimes 50+ item height. */}
            {loading ? (
              <div
                className={cn('flex items-center justify-center h-[var(--fd-h)]', fillHeight && 'lg:h-auto lg:flex-1 lg:min-h-0')}
                style={{ '--fd-h': `${maxHeight * 0.25}rem` } as React.CSSProperties}
              >
                <Spinner size="sm" />
              </div>
            ) : disabled ? (
              // Same footprint as the checkbox list below so this filter's
              // overall height doesn't visibly jump once enabled.
              <div
                className={cn('flex items-center justify-center text-center h-[var(--fd-h)]', fillHeight && 'lg:h-auto lg:flex-1 lg:min-h-0')}
                style={{ '--fd-h': `${maxHeight * 0.25}rem` } as React.CSSProperties}
              >
                <p className="text-muted text-sm">{disabledMessage}</p>
              </div>
            ) : (() => {
              const groups = groupFor ? groupItems(filtered, groupFor) : null
              // A single group (e.g. only one Make checked) reads as
              // pointless header clutter -- falls back to one flat list.
              const showGroups = groups && groups.length > 1
              // content-start/items-start: a CSS grid's rows stretch by
              // default (align-content: normal behaves like 'stretch') to
              // fill any leftover space in the container -- harmless when
              // there are enough items to fill it, but with just a few
              // (e.g. 4 models in a 2-up grid inside a fillHeight column)
              // the few rows there are get stretched to fill that whole
              // height, blowing up each checkbox instead of just leaving
              // blank space below them. Reused per-group below too, since
              // the same issue applies there.
              const itemsGrid = columns === 3 ? "grid grid-cols-3 content-start items-start"
                : columns === 2 ? "grid grid-cols-2 content-start items-start"
                : "flex flex-col"

              return (
                <div
                  className={cn(
                    showGroups ? "flex flex-col" : itemsGrid,
                    "gap-2 overflow-y-auto min-w-0 max-h-[var(--fd-h)]",
                    fillHeight && 'lg:max-h-none lg:flex-1 lg:min-h-0'
                  )}
                  style={{ '--fd-h': `${maxHeight * 0.25}rem` } as React.CSSProperties}
                >
                  {filtered.length === 0 ? (
                    <p className="text-muted text-sm">{t('noResults')}</p>
                  ) : showGroups ? (
                    groups!.map((group) => (
                      <div key={group.label} className="flex flex-col gap-2">
                        <p className="text-xs font-semibold text-muted uppercase tracking-wide px-0.5">{group.label}</p>
                        <div className={cn(itemsGrid, "gap-2")}>
                          {group.items.map(item => (
                            <Checkbox
                              key={`${item}-${clearCount}`}
                              label={displayLabel(item)}
                              icon={iconFor?.(item)}
                              defaultChecked={selected.includes(item)}
                              onChange={() => toggleItem(item)}
                              labelClassName={itemLabelClassName}
                              className={itemClassName}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    filtered.map(item => (
                      <Checkbox
                        key={`${item}-${clearCount}`}
                        label={displayLabel(item)}
                        icon={iconFor?.(item)}
                        defaultChecked={selected.includes(item)}
                        onChange={() => toggleItem(item)}
                        labelClassName={itemLabelClassName}
                        className={itemClassName}
                      />
                    ))
                  )}
                </div>
              )
            })()}

            { showApplyButton && (
              <Button onClick={() => onApply(selected)} variant='primary' size='sm' className='w-full' disabled={disabled}>{t('apply')}</Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}