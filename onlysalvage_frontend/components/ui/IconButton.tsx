import React from "react"
import { cn } from "@/lib/utils"

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ElementType
  outlineColor?: string
  filled?: boolean
  label?: string
  // Listing cards show many of these packed tightly together (like, in a
  // scrolling grid) -- a tooltip there just adds visual noise, so callers in
  // that context opt out while still keeping `label` for aria-label.
  showTooltip?: boolean
}

export function IconButton({ icon: Icon, label, outlineColor="text-foreground", filled = false, showTooltip = true, className = "", ...props }: IconButtonProps) {
  return (
    <span className="relative group inline-flex">
      <button
        aria-label={label}
        {...props}
        className={cn(
          'inline-flex items-center justify-center rounded-full p-3 transition [@media(hover:hover)]:hover:bg-surface-raised cursor-pointer',
          className
        )}
      >
        <Icon className={cn("w-6 h-6", outlineColor)} {...(filled ? { fill: "currentColor" } : {})} />
      </button>
      {label && showTooltip && (
        <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
          {label}
        </span>
      )}
    </span>
  );
}