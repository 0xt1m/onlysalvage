'use client'

import { useTranslations } from 'next-intl'
import { PHOTO_DESCRIPTOR_KEYS } from '@/lib/types'
import { cn } from '@/lib/utils'

// The MIME type used for the drag payload -- thumbnails below listen for
// this specifically (see their onDrop handlers) rather than accepting any
// drag, so dropping a random OS file here doesn't get misread as a label.
export const PHOTO_DESCRIPTOR_DRAG_TYPE = 'application/x-photo-descriptor'

interface PhotoDescriptorPaletteProps {
  className?: string
  // Descriptors already assigned to some photo on this listing -- each one
  // only makes sense on a single photo, so once it's placed it's removed
  // from the palette rather than left sitting there implying it's still free.
  usedKeys?: string[]
}

// A palette of draggable labels -- drag one onto a gallery photo below to
// tag it (better alt text for SEO/accessibility -- see PhotoGallery). Plain
// HTML5 drag-and-drop, same lightweight approach as Dropzone's own file
// drag-and-drop, no library needed for something this simple.
export function PhotoDescriptorPalette({ className, usedKeys }: PhotoDescriptorPaletteProps) {
  const t = useTranslations('PhotoDescriptors')
  const available = usedKeys?.length ? PHOTO_DESCRIPTOR_KEYS.filter((key) => !usedKeys.includes(key)) : PHOTO_DESCRIPTOR_KEYS

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {available.map((key) => (
        <div
          key={key}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(PHOTO_DESCRIPTOR_DRAG_TYPE, key)
            e.dataTransfer.effectAllowed = 'copy'
          }}
          className="text-xs px-2.5 py-1 rounded-full border border-border bg-surface-raised cursor-grab active:cursor-grabbing select-none hover:border-primary-light hover:text-primary-light transition-colors"
        >
          {t(key)}
        </div>
      ))}
    </div>
  )
}
