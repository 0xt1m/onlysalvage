'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface CheckboxProps {
    label?: string
    icon?: React.ElementType
    defaultChecked?: boolean
    onChange?: (checked: boolean) => void
    disabled?: boolean
    className?: string
    // Overrides just the label text's classes (default text-sm) -- e.g. a
    // dense multi-column grid of items (FilterDropdown's colors) where the
    // usual size makes labels wrap or crowd their neighbors.
    labelClassName?: string
    // For a checkbox with no visible `label` text of its own -- e.g. one
    // sitting next to an already-labeled card, where a redundant on-screen
    // label would just duplicate what's right beside it.
    'aria-label'?: string
}

export function Checkbox({
    label,
    icon: Icon,
    defaultChecked = false,
    onChange,
    disabled = false,
    className,
    labelClassName,
    'aria-label': ariaLabel
}: CheckboxProps) {
    const [checked, setChecked] = useState(defaultChecked)

    function handleChange(value: boolean) {
        setChecked(value)
        onChange?.(value)
    }

    return (
        // py-2/px-1.5 extend the actual tap target well beyond just the
        // 18x18 box + text -- the whole row is clickable already (it's one
        // <label>), but without this the row's own height was only ever as
        // tall as its text, which is too thin to reliably hit with a finger.
        // No negative margin here -- these already sit inside the filter
        // card's own padding, so canceling it out just crowds the checkbox
        // against the card's edge instead of keeping it evenly inset.
        <label className={cn(
            'flex items-center gap-2 min-w-0 cursor-pointer select-none rounded-md py-2 px-1.5 transition-colors',
            !disabled && '[@media(hover:hover)]:hover:bg-surface-raised',
            disabled && 'opacity-50 cursor-not-allowed',
            className
        )}>
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => handleChange(e.target.checked)}
                disabled={disabled}
                aria-label={ariaLabel}
                className='hidden'
            />
            <div className={cn(
                'w-[18px] h-[18px] shrink-0 rounded border border-border flex items-center justify-center transition-colors duration-50',
                checked ? 'bg-primary border-primary' : 'bg-surface'
            )}>
                {checked && (
                    <svg
                        className='w-3 h-3 text-white'
                        viewBox='0 0 24 24'
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                    >
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                )}
            </div>
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            {label && <span className={cn('text-sm text-foreground break-words min-w-0', labelClassName)}>{label}</span>}
        </label>
    )
}