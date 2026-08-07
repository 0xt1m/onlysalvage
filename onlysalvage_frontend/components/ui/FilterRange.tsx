'use client'

import { useState, type ElementType } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

import { RangeSlider } from '@/components/ui/RangeSlider';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';


interface FilterRangeProps {
    title: string
    // Leading icon next to the title -- purely visual.
    icon?: ElementType
    min?: number
    max?: number
    step?: number
    defaultValue?: [number, number]
    showApplyButton?: Boolean
    onApply?: (value: [number, number]) => void
    className?: string
    // Forwarded to the slider's drag tooltip (e.g. "$12,500" for price,
    // "45,000 mi" for mileage) -- defaults to a plain formatted number.
    formatValue?: (value: number) => string
    // Shows an "Any" button inside the max field that jumps straight to
    // `max` -- e.g. price/mileage are capped at a fixed slider ceiling
    // (100k/200k) for a usable drag range, but a listing can genuinely be
    // priced above that, so this is the explicit "no upper limit" escape
    // hatch rather than making someone drag to the exact pixel at the end
    // of the track.
    allowAnyMax?: boolean
}

function parseValid(text: string): number | null {
    const trimmed = text.trim()
    if (trimmed === '') return null
    const n = Number(trimmed)
    return Number.isFinite(n) && n >= 0 ? n : null
}

export function FilterRange({ title, icon: Icon, min=0, max=100, step=1, defaultValue, showApplyButton = true, onApply, className, formatValue, allowAnyMax = false }: FilterRangeProps) {
    const t = useTranslations('Filters')
    const initial = defaultValue || [min, max]
    // Free text, not derived from the committed [number, number] range below
    // -- these fields need to hold whatever's actually been typed so far
    // (including a value outside min/max, or mid-edit garbage), which a
    // value clamped/round-tripped through the committed range can't do
    // without stomping on every keystroke (e.g. typing "2020" into a field
    // clamped to a min of 1946 got forced back to "1946" after the first
    // "2"). Committed separately below, only once each field actually
    // parses to a sensible number.
    const [minText, setMinText] = useState(`${initial[0]}`)
    const [maxText, setMaxText] = useState(`${initial[1]}`)
    const [maxFocused, setMaxFocused] = useState(false)
    const [range, setRange] = useState<[number, number]>(initial)

    // Typing the word itself (in English or the current locale) works the
    // same as clicking the "Any" button -- resolves straight to the ceiling
    // rather than being flagged as an invalid, unparseable number.
    const isAnyKeyword = (text: string) => {
        const normalized = text.trim().toLowerCase()
        return normalized === 'any' || normalized === t('any').trim().toLowerCase()
    }
    const parseMax = (text: string) => (isAnyKeyword(text) ? max : parseValid(text))

    const minValue = parseValid(minText)
    const maxValue = parseMax(maxText)
    // "Doesn't make sense" -- unparseable, negative, or crossed against the
    // other field -- not merely outside this component's own min/max, which
    // are just the slider's cosmetic drag range. A real listing can be
    // priced above the slider's ceiling, so typing e.g. 150000 into a price
    // field capped at 100000 is fine; leaving it blank or typing "abc" isn't.
    const minInvalid = minValue === null || (maxValue !== null && minValue > maxValue)
    const maxInvalid = maxValue === null || (minValue !== null && maxValue < minValue)

    // With no Apply button of its own, this widget has no other way to report
    // a change -- it fires live instead, on every valid edit, rather than only
    // once a button is clicked. Skipped entirely while either field is
    // currently invalid, so the parent's pending state never sees NaN/crossed
    // values -- it just keeps the last-known-good range until typing resolves
    // to something sensible again.
    const commit = (next: [number, number]) => {
        setRange(next)
        if (!showApplyButton) onApply?.(next)
    }

    const handleMinChange = (text: string) => {
        setMinText(text)
        const parsed = parseValid(text)
        if (parsed !== null && (maxValue === null || parsed <= maxValue)) {
            commit([parsed, range[1]])
        }
    }

    const handleMaxChange = (text: string) => {
        setMaxText(text)
        const parsed = parseMax(text)
        if (parsed !== null && (minValue === null || parsed >= minValue)) {
            commit([range[0], parsed])
        }
    }

    // The slider itself can't represent a value outside [min, max] (Radix
    // clamps thumb dragging there), so what's shown on the track is purely
    // cosmetic -- clamped for display only, completely separate from the
    // real, unclamped `range` that's actually applied/sent to the backend.
    const sliderValue: [number, number] = [
        Math.min(Math.max(range[0], min), max),
        Math.min(Math.max(range[1], min), max),
    ]

    const handleSliderChange = ([newMin, newMax]: [number, number]) => {
        setMinText(`${newMin}`)
        setMaxText(`${newMax}`)
        commit([newMin, newMax])
    }

    // Clicking "Any" when the max is already untouched (still sitting at
    // its default ceiling) sets it to a value it's already at -- a no-op
    // that looks exactly like nothing happened. Showing "Any" as the max
    // field's displayed value (instead of the raw ceiling number) whenever
    // it's at that ceiling makes the state visible regardless of whether
    // anything actually changed. Only while it isn't the field being actively
    // typed into -- otherwise every value at exactly the ceiling would be
    // unbackspaceable, since each render would swap it right back to "Any".
    const isAnyMax = allowAnyMax && !maxFocused && maxValue === max

    return (
        <Card className={className}>
            <span className="flex items-center gap-2 text-foreground font-medium m-1">
                {Icon && <Icon className="w-4 h-4 text-muted shrink-0" />}
                {title}
            </span>
            <RangeSlider
                min={min}
                max={max}
                step={step}
                value={sliderValue}
                onValueChange={handleSliderChange}
                formatValue={formatValue}
            />
            <div className="flex flex-row gap-2 items-start">
                <Input
                    label={t('min')}
                    value={minText}
                    onChange={(e) => handleMinChange(e.target.value)}
                    error={minInvalid ? t('invalidNumber') : undefined}
                    className="rounded-md w-full text-sm"
                />
                <Input
                    label={t('max')}
                    value={isAnyMax ? t('any') : maxText}
                    onChange={(e) => handleMaxChange(e.target.value)}
                    onFocus={() => setMaxFocused(true)}
                    onBlur={() => setMaxFocused(false)}
                    error={maxInvalid ? t('invalidNumber') : undefined}
                    className="rounded-md w-full text-sm"
                    suffix={allowAnyMax && (
                        <button
                            type="button"
                            onClick={() => handleMaxChange(`${max}`)}
                            className={cn(
                                'text-xs font-medium px-1.5 py-1 rounded transition-colors',
                                isAnyMax
                                    ? 'bg-primary-light/20 text-primary-light'
                                    : 'text-muted hover:text-primary-light'
                            )}
                        >
                            {t('any')}
                        </button>
                    )}
                />
            </div>

            { showApplyButton && (
                <Button variant="primary" size='sm' onClick={() => onApply?.(range)} disabled={minInvalid || maxInvalid}>{t('apply')}</Button>
            )}

         </Card>
    )
}
