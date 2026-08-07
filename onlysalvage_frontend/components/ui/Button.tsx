import { cn } from '@/lib/utils'

const sizes = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
}

interface ButtonProps {
    children: React.ReactNode
    variant?: 'primary' | 'secondary' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    className?: string
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
    type?: "submit" | "button" | "reset"
    disabled?: boolean
}

export function Button({ children, variant = 'primary', size = 'md', className, onClick, type, disabled }: ButtonProps) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'px-4 py-2 rounded-md font-medium transition-colors cursor-pointer',
                variant == 'primary' && 'bg-primary-light text-white hover:bg-primary-hover',
                variant == 'secondary' && 'bg-surface border border-border text-foreground',
                variant == 'ghost' && 'text-muted border border-border hover:text-foreground',
                sizes[size],
                disabled && 'opacity-50 cursor-not-allowed',
                className
            )}
            type={type}
        >
            {children}

        </button>
    )
}