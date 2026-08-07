import { cn } from '@/lib/utils'

interface BadgeProps {
    label: string
    variant?: 'default' | 'success' | 'warning' | 'error' | 'primary'
    className?: string
}

const variants = {
    default: 'bg-surface text-muted border border-border',
    primary: 'bg-primary text-white',
    success: 'bg-success/90 text-white',
    warning: 'bg-warning/90 text-white',
    error: 'bg-error/90 text-white',
}

export function Badge({ label, variant = 'default', className }: BadgeProps) {
    return (
        <span className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
            variants[variant],
            className
        )}>
            {label}
        </span>
    )
}