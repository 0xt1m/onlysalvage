import React from "react";

interface InfoItemProps {
  icon?: React.ElementType
  label?: string
  value: string
  hideLabelOnMobile?: boolean
}

export function InfoItem({ icon: Icon, label, value, hideLabelOnMobile }: InfoItemProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted min-w-0">
      {Icon && <Icon className="w-4 h-4 text-muted shrink-0" />}
      {label && (
        <span className={hideLabelOnMobile ? 'font-medium shrink-0 hidden sm:inline' : 'font-medium shrink-0'}>
          {label}:
        </span>
      )}
      {value && <span className="text-foreground truncate min-w-0 flex-1">{value}</span>}
    </div>
  )
}