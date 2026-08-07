'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils';

interface InputProps {
    label?: string
    placeholder?: string
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
    onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void
    onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
    type?: string
    min?: string
    error?: string
    disabled?: boolean
    // Unlike disabled, this only locks the text field itself -- an
    // attached endButton (e.g. "Verify"/"Change") stays fully clickable,
    // for cases where typing directly should be blocked but the button
    // that lets you actually change the value shouldn't be.
    readOnly?: boolean
    className?: string
    // An inline control rendered inside the input's own right edge (e.g. an
    // "Any" button for a range's max field) -- adds right padding to the
    // input automatically so typed text never sits underneath it. Floats on
    // top of the input; for a control that should look like an actual
    // attached button (its own border, sharing the input's edge), use
    // endButton instead.
    suffix?: React.ReactNode
    // Renders as a bordered segment sharing the input's own outer border --
    // together they read as one control (input on the left, button on the
    // right), rather than a floating icon inside the input like suffix.
    endButton?: {
        label: React.ReactNode
        onClick: () => void
        disabled?: boolean
    }
}

export function Input({ label, placeholder, value, onChange, onKeyDown, onFocus, onBlur, type = 'text', min, error, disabled, readOnly, className, suffix, endButton }: InputProps) {
    const t = useTranslations('Common')
    const [showPassword, setShowPassword] = useState(false)
    const isPassword = type === 'password'

    if (endButton) {
        return (
            <div className="flex flex-col gap-1 w-full min-w-0">
                {label && <label className="text-sm text-foreground">{label}</label>}
                <div
                    className={cn(
                        'flex w-full min-w-0 bg-surface border rounded-md outline-none transition-colors overflow-hidden',
                        'focus-within:border-primary',
                        error ? 'border-error' : 'border-border',
                        disabled && 'opacity-50 cursor-not-allowed',
                    )}
                >
                    <input
                        placeholder={placeholder}
                        value={value}
                        onChange={onChange}
                        onKeyDown={onKeyDown}
                        onFocus={onFocus}
                        onBlur={onBlur}
                        type={type}
                        min={min}
                        disabled={disabled}
                        readOnly={readOnly}
                        className={cn(
                            'flex-1 min-w-0 bg-transparent px-3 py-2 text-foreground outline-none',
                            'placeholder:text-muted',
                            readOnly && 'cursor-default',
                            className
                        )}
                    />
                    <button
                        type="button"
                        onClick={endButton.onClick}
                        disabled={disabled || endButton.disabled}
                        className="shrink-0 px-3 text-sm font-medium text-primary border-l border-border hover:bg-surface-raised transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {endButton.label}
                    </button>
                </div>
                {error && <span className="text-xs text-error">{error}</span>}
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-1 w-full min-w-0">
            {label && <label className="text-sm text-foreground">{label}</label>}
            <div className="relative w-full min-w-0">
                <input
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                    onKeyDown={onKeyDown}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    type={isPassword && showPassword ? 'text' : type}
                    min={min}
                    disabled={disabled}
                    readOnly={readOnly}
                    className={cn(
                        'w-full min-w-0 bg-surface border rounded-md px-3 py-2 text-foreground outline-none transition-colors',
                        'placeholder:text-muted',
                        'focus:border-primary',
                        (suffix || isPassword) && 'pr-12',
                        error ? 'border-error' : 'border-border',
                        disabled && 'opacity-50 cursor-not-allowed',
                        readOnly && 'cursor-default',
                        className
                    )}
                />
                {isPassword ? (
                    <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        disabled={disabled}
                        tabIndex={-1}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-foreground transition-colors disabled:opacity-50"
                        aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                    >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                ) : suffix && (
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                        {suffix}
                    </div>
                )}
            </div>
            {error && <span className="text-xs text-error">{error}</span>}
        </div>
    )
}