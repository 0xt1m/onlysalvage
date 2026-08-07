import { cn } from '@/lib/utils'

interface CardProps {
    children?: React.ReactNode
    className?: string
    id?: string
    // Not part of a Card's usual visual API -- only exists so a Card can
    // double as a dismissible drawer/modal panel (see InventoryBrowser's
    // filter panel) without losing keyboard focus/screen-reader access while
    // it's animated closed but still technically in the DOM.
    inert?: boolean
    onClick?: () => void
}

export function Card({ children, className, id, inert, onClick }: CardProps) {
    return (
        <div id={id} inert={inert} onClick={onClick} className={cn('bg-surface border border-border rounded-lg p-6 flex flex-col gap-3', className)}>
            {children}
        </div>
    )
}