'use client'

import { Link } from "@/i18n/navigation"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface CategoryBoxProps {
  label: string
  href: string
  backgroundImage?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeStyles = {
  sm: "w-32 h-32 min-w-32 text-xs hover:text-sm",
  md: "w-40 h-40 min-w-40 text-sm hover:text-base",
  lg: "w-48 h-48 min-w-48 text-base hover:text-lg"
}

export function CategoryBox({ label, href, backgroundImage, size = "md"}: CategoryBoxProps) {
  return (
    <Link
      href={href}
      className={cn(
        "p-1 bg-primary relative overflow-hidden flex flex-col items-center justify-center border border-border rounded-lg transition-all duration-50 aspect-square text-white font-medium",
        sizeStyles[size],
      )}
    >
    {backgroundImage && (
      <Image
        src={backgroundImage}
        alt={label}
        fill
        className="object-cover opacity-40"
      />
    )}
      <span className="z-10">{label}</span>
    </Link>
  )
}