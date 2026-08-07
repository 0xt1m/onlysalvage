"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { IconButton } from "@/components/ui/IconButton";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils"
import { flyToWatchlistIcon } from "@/lib/flyToIcon"

interface LikeButtonProps {
  liked?: boolean
  onToggle?: (liked: boolean) => void
  className?: string
  showTooltip?: boolean
}

export function LikeButton({ liked, onToggle, className, showTooltip = true }: LikeButtonProps) {
  const t = useTranslations("LikeButton")
  return (
    <IconButton
      icon={Heart}
      label={t("like")}
      filled={liked}
      outlineColor="text-accent"
      onClick={(e) => {
        const next = !liked
        // Only on add, not remove -- same as the compare icon's animation.
        if (next) flyToWatchlistIcon(e.clientX, e.clientY)
        onToggle?.(next)
      }}
      showTooltip={showTooltip}
      className={cn(
        '',
        className
      )}
    />
  );
}