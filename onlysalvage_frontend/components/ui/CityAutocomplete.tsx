'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { autocompleteAddress, getAddressDetails } from '@/lib/api'

interface CitySuggestion {
  place_id: string
  description: string
}

interface CityAutocompleteProps {
  label?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onCitySelect: (location: { city: string; state: string }) => void
  error?: string
  className?: string
  // For an already-filled-in field (e.g. a saved profile city) that
  // shouldn't start actively searching/suggesting the moment it mounts --
  // renders read-only with an edit button in place of the loading spinner
  // until `onUnlock` fires. Both omitted (the default) behaves exactly as
  // before: a plain always-editable autocomplete.
  locked?: boolean
  onUnlock?: () => void
  editAriaLabel?: string
}

// Shorter than AddressAutocomplete's minimum -- city names (and their
// abbreviations, e.g. "NY") are meaningfully shorter than street addresses.
const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300

export function CityAutocomplete({ label, placeholder, value, onChange, onCitySelect, error, className, locked = false, onUnlock, editAriaLabel = 'Edit' }: CityAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set right after a selection so the resulting `value` change (the picked
  // city filling the field) doesn't immediately re-trigger a fresh search
  // for what the user just chose.
  const skipNextSearchRef = useRef(false)
  // Read (not depended on) by the search effect below -- see its comment.
  const lockedRef = useRef(locked)
  useEffect(() => {
    lockedRef.current = locked
    // Closing any dropdown left open from right before this field got
    // locked again (e.g. a "cancel edit" action elsewhere).
    if (locked) {
      setOpen(false)
      setSuggestions([])
    }
  }, [locked])

  useEffect(() => {
    if (lockedRef.current) return

    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    const query = value.trim()
    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      const results = await autocompleteAddress(query, { citiesOnly: true })
      setLoading(false)
      setSuggestions(results)
      setHighlighted(0)
      setOpen(results.length > 0)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // `locked` deliberately isn't a dependency here -- it's read via
    // lockedRef instead, so unlocking the field doesn't itself re-run this
    // effect and immediately pop suggestions for whatever value was already
    // sitting in the field; only the user actually changing `value` from
    // here on should trigger a real search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

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

  const selectSuggestion = async (suggestion: CitySuggestion) => {
    setOpen(false)
    setSuggestions([])
    const details = await getAddressDetails(suggestion.place_id)
    if (!details || !details.city) return
    skipNextSearchRef.current = true
    onChange(details.city)
    onCitySelect({ city: details.city, state: details.state })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((i) => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      selectSuggestion(suggestions[highlighted])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="flex flex-col gap-1 w-full min-w-0" ref={containerRef}>
      {label && <label className="text-sm text-foreground">{label}</label>}
      {/* onDoubleClick sits on this wrapper, not the <input> itself -- since
          the input fills the entire wrapper, in practice this only matters
          because of the readOnly/disabled choice below, not because of
          where the handler lives. */}
      <div
        className="relative"
        onDoubleClick={(e) => {
          // Otherwise a double-click both unlocks the field *and* selects
          // the word under the cursor (the browser's native dblclick
          // behavior on readOnly text) -- unlocking should be the only
          // visible effect.
          if (locked) { e.preventDefault(); onUnlock?.() }
        }}
      >
        <input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
          autoComplete="off"
          // readOnly, not disabled -- a disabled input is spec'd to not
          // dispatch mouse events at all (not even bubbling ones), so with
          // disabled the onDoubleClick above never actually fired: the
          // input covers the entire wrapper, leaving no dead space for the
          // div to catch the event on. readOnly still blocks typing but
          // behaves normally for click/dblclick.
          readOnly={locked}
          className={cn(
            'w-full min-w-0 bg-surface border rounded-md px-3 py-2 text-foreground outline-none transition-colors',
            'placeholder:text-muted',
            'focus:border-primary',
            locked && 'pr-10 opacity-70 cursor-default',
            error ? 'border-error' : 'border-border',
            className
          )}
        />
        {locked ? (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 group inline-flex">
            <button
              type="button"
              onClick={onUnlock}
              className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-surface-raised transition-colors"
              aria-label={editAriaLabel}
            >
              <Pencil className="w-4 h-4" />
            </button>
            {/* right-0 (not centered) -- centering here risked the same
                horizontal-overflow issue the range slider tooltip had near
                the edge of its own container (see RangeSlider), since this
                sits flush against the input's right edge. */}
            <span className="pointer-events-none absolute right-0 bottom-full mb-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
              {editAriaLabel}
            </span>
          </span>
        ) : (
          loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted animate-spin" />
        )}

        {open && suggestions.length > 0 && (
          <ul role="listbox" className="absolute z-20 top-full mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-border bg-surface shadow-lg py-1">
            {suggestions.map((s, i) => (
              <li
                key={s.place_id}
                role="option"
                aria-selected={i === highlighted}
                onMouseEnter={() => setHighlighted(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(s)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer text-foreground',
                  i === highlighted && 'bg-surface-raised'
                )}
              >
                <MapPin className="w-3.5 h-3.5 text-muted shrink-0" />
                <span className="truncate">{s.description}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  )
}
