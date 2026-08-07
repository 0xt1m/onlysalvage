'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface SwitchProps {
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}

// A binary on/off control that reads as a state (published/unpublished,
// active/inactive) rather than a form-selection the way Checkbox does --
// same uncontrolled-with-callback shape as Checkbox, just a different
// visual for a different kind of boolean.
export function Switch({ defaultChecked = false, onChange, disabled = false, className, ...rest }: SwitchProps) {
  const [checked, setChecked] = useState(defaultChecked)

  const handleClick = () => {
    if (disabled) return
    const next = !checked
    setChecked(next)
    onChange?.(next)
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer',
        checked ? 'bg-primary-light' : 'bg-border',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      {...rest}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}
