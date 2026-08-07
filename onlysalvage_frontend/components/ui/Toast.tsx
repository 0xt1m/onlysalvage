'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error' | 'warning' | 'default'

interface Toast {
    id: number
    message: string
    variant?: ToastVariant
}

interface ToastContextType {
    showToast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

const variants = {
    default: 'bg-surface border-border text-foreground',
    success: 'bg-surface border-success text-success',
    error: 'bg-surface border-error text-error',
    warning: 'bg-surface border-warning text-warning',
}


const icons = {
    default: '🔔',
    success: '✅',
    error: '❌',
    warning: '⚠️',
}

export function ToastProvider({ children }: { children : React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const [mounted, setMounted] = useState(false)

    useEffect(() => {
    setMounted(true)
    }, [])

    const showToast = useCallback((message: string, variant: ToastVariant = 'default') => {
        const id = Date.now()
        setToasts(prev => [...prev, { id, message, variant}])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 3000)
    }, [])

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            {mounted && createPortal(
            <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-[9999]">
                {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={cn(
                    'flex items-center justify-between gap-3 px-4 py-3 rounded-lg border shadow-sm',
                    variants[toast.variant || 'default']
                    )}
                >
                    <span>{icons[toast.variant || 'default']}</span>
                    <p className="text-sm">{toast.message}</p>
                    <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}>
                    ✕
                    </button>
                </div>
                ))}
            </div>,
            document.body
            )}
        </ToastContext.Provider>
    )
}

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) throw new Error('useToast must be used witin a ToastProvider')
    return context
}