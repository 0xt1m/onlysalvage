import Image from 'next/image'
import { cn } from '@/lib/utils'

interface AvatarProps {
    src?: string
    alt?: string
    name?: string
    size?: 'sm' | 'md' | 'lg'
    className?: string
}

const sizes = {
    'sm': 'w-8 h-8 text-xs',
    'md': 'w-10 h-10 text-sm',
    'lg': 'w-16 h-16 text-lg',
}

export function Avatar({ src, alt, name, size = 'md', className }: AvatarProps) {
    const initials = name
        ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : '?'

    return (
        <div className={cn(
            'relative rounded-full bg-primary border border-border flex items-center justify-center overflow-hidden flex-shrink-0',
            sizes[size],
            className
        )}>
            {src ? (
                <Image src={src} alt={alt || name || 'avatar'} fill className='object-contain' />
            ) : (
                <span className="text-white font-medium">{initials}</span>
            )}
        </div>
    )
}