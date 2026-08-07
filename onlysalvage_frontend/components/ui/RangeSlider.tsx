'use client'

import { useState } from 'react'
import * as Slider from '@radix-ui/react-slider'
import { cn } from '@/lib/utils'

interface RangeSliderProps {
    min?: number
    max?: number
    step?: number
    value?: [number, number]
    onValueChange?: (value: [number, number]) => void
    className?: string
    // Shown in a small tooltip above whichever thumb is active (hovered,
    // focused, or being dragged) -- e.g. "$12,500" for price, "45,000" for
    // mileage. Defaults to the plain locale-formatted number.
    formatValue?: (value: number) => string
}

// Below this percent the tooltip anchors to the track's left edge instead
// of centering on the thumb, and above (100 - this) it anchors to the
// right edge -- centering unconditionally would push the tooltip past the
// track's own bounding box near either end, which (since an ancestor
// column forces overflow-x: auto once it sets overflow-y: auto -- see
// InventoryBrowser) shows up as a real horizontal scrollbar rather than
// just clipped text.
const EDGE_THRESHOLD = 15

export function RangeSlider({
    min = 0,
    max = 100,
    step = 1,
    value = [min, max],
    onValueChange,
    className,
    formatValue = (v) => v.toLocaleString(),
}: RangeSliderProps) {
    // Which thumb (0 = min, 1 = max) to show the value tooltip above --
    // null hides it. Tracked locally rather than derived from Radix's own
    // state since Slider.Thumb doesn't expose a "currently dragging" flag;
    // pointer/focus events on each thumb are the only signal available.
    const [activeThumb, setActiveThumb] = useState<number | null>(null)

    // Guards against a 0/0 (min === max) NaN, which would otherwise land
    // every tooltip/thumb at the same spot instead of a sane default.
    const percentFor = (v: number) => (max > min ? ((v - min) / (max - min)) * 100 : 0)

    return (
        <Slider.Root
            min={min}
            max={max}
            step={step}
            value={value}
            onValueChange={onValueChange}
            className={cn('relative flex items-center w-full h-5', className)}
        >
            <Slider.Track className="relative w-full h-1 bg-border rounded-full">
                <Slider.Range className="absolute h-full bg-primary rounded-full" />
            </Slider.Track>

            {([0, 1] as const).map((i) => (
                <Slider.Thumb
                    key={i}
                    onPointerDown={() => setActiveThumb(i)}
                    onPointerUp={() => setActiveThumb(null)}
                    onPointerCancel={() => setActiveThumb(null)}
                    onMouseEnter={() => setActiveThumb((cur) => cur ?? i)}
                    onMouseLeave={() => setActiveThumb((cur) => (cur === i ? null : cur))}
                    onFocus={() => setActiveThumb(i)}
                    onBlur={() => setActiveThumb((cur) => (cur === i ? null : cur))}
                    className={cn(
                        // No border ring here (there was a border-surface
                        // one) -- Radix positions the thumb so its full
                        // box, border included, sits flush with the
                        // track's 0%/100% edges, but a border colored to
                        // match the page background reads as empty space,
                        // making the visibly-dark part of the thumb look
                        // like it stops short of the tip instead of
                        // reaching it.
                        'relative block w-[18px] h-[18px] bg-primary rounded-full shadow-md cursor-pointer',
                        'transition-transform duration-150 hover:scale-110 active:scale-125',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-light focus-visible:ring-offset-2 focus-visible:ring-offset-surface'
                    )}
                />
            ))}

            {([0, 1] as const).map((i) => {
                const percent = percentFor(value[i])
                // Anchored by `left: {percent}%` (relative to the track,
                // not the thumb, so it can be clamped independently of
                // wherever the thumb's own transform puts it) plus a
                // matching translateX: -50% to center under the thumb, 0%
                // once close enough to the left edge that centering would
                // push it negative, -100% near the right edge for the same
                // reason in the other direction.
                const edge = percent < EDGE_THRESHOLD ? 'left' : percent > 100 - EDGE_THRESHOLD ? 'right' : 'center'
                return (
                    <span
                        key={i}
                        style={{
                            left: `${percent}%`,
                            transform: edge === 'left' ? 'translateX(0)' : edge === 'right' ? 'translateX(-100%)' : 'translateX(-50%)',
                        }}
                        className={cn(
                            'absolute -top-8 px-1.5 py-0.5 rounded-md bg-primary text-white text-xs font-medium whitespace-nowrap pointer-events-none transition-opacity duration-150',
                            activeThumb === i ? 'opacity-100' : 'opacity-0'
                        )}
                    >
                        {formatValue(value[i])}
                    </span>
                )
            })}
        </Slider.Root>
    )
}
