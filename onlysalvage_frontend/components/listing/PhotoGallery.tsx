'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Car, ChevronLeft, ChevronRight, Loader2, Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn, safeImageUrl } from '@/lib/utils'
import type { ListingImage } from '@/lib/types'

interface PhotoGalleryProps {
  images: ListingImage[]
  title: string
  statusBadge?: { label: string; variant: 'success' | 'warning' | 'error' | 'primary' | 'default' }
}

const ZOOM_MIN = 1
// Was 3 -- too low to actually inspect damage closely against large_url's
// 2400px cap (see the fullscreen Image's src comment below for why this
// serves that derivative rather than the untouched original).
const ZOOM_MAX = 6
const ZOOM_STEP = 0.5
const WHEEL_ZOOM_STEP = 0.3
const SWIPE_THRESHOLD = 50

function pointerDistance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function PhotoGallery({ images, title, statusBadge }: PhotoGalleryProps) {
  const t = useTranslations('PhotoGallery')
  const [index, setIndex] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  // Live horizontal offset (px) while dragging the preview strip, so the
  // image actually tracks the finger/cursor instead of only cutting to the
  // next photo once a swipe is already resolved.
  const [dragOffset, setDragOffset] = useState(0)
  const [previewDragging, setPreviewDragging] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  // The fullscreen image serves the untouched original (see the src comment
  // below), which can be genuinely slow to load the first time -- without
  // this, there's nothing but the black overlay background behind it while
  // that's in flight, which reads as broken rather than loading.
  const [fullscreenLoaded, setFullscreenLoaded] = useState(false)
  // The "3 / 12" counter in the fullscreen viewer opens this -- a grid of
  // every photo to jump straight to one, since fullscreen (unlike the
  // regular preview) has no thumbnail strip of its own to pick from.
  const [showGrid, setShowGrid] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const maxPan = useRef({ x: 0, y: 0 })

  // Multi-touch bookkeeping for the fullscreen viewer: `pointers` tracks every
  // finger currently down so a second touch can be detected (pinch), `pinch`
  // records the two-finger baseline distance/zoom to scale from, and
  // `swipeStart` records a single finger's origin so a released drag can be
  // judged a swipe (only when not zoomed in, so it doesn't fight panning).
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ distance: number; zoom: number } | null>(null)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)

  const goTo = (i: number) => setIndex((i + images.length) % images.length)
  const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, +z.toFixed(2)))
  const zoomBy = (delta: number) => setZoom((z) => clampZoom(z + delta))
  const zoomIn = () => zoomBy(ZOOM_STEP)
  const zoomOut = () => zoomBy(-ZOOM_STEP)

  const clampPan = (p: { x: number; y: number }) => ({
    x: Math.min(maxPan.current.x, Math.max(-maxPan.current.x, p.x)),
    y: Math.min(maxPan.current.y, Math.max(-maxPan.current.y, p.y)),
  })

  const computeMaxPan = (z: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    maxPan.current = {
      x: rect ? (rect.width * (z - 1)) / 2 : 0,
      y: rect ? (rect.height * (z - 1)) / 2 : 0,
    }
  }

  const resolveSwipe = (e: React.PointerEvent) => {
    if (!swipeStart.current) return
    const dx = e.clientX - swipeStart.current.x
    const dy = e.clientY - swipeStart.current.y
    swipeStart.current = null
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      goTo(index + (dx < 0 ? 1 : -1))
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Ignore -- some browsers throw if the pointer session is already gone.
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2) {
      // Second finger just landed -- switch from panning/swiping to pinching.
      setIsDragging(false)
      swipeStart.current = null
      const [p1, p2] = Array.from(pointers.current.values())
      pinch.current = { distance: pointerDistance(p1, p2), zoom }
      return
    }

    if (pointers.current.size === 1) {
      swipeStart.current = { x: e.clientX, y: e.clientY }
      if (zoom > 1) {
        setIsDragging(true)
        computeMaxPan(zoom)
        dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
      }
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 2 && pinch.current) {
      const [p1, p2] = Array.from(pointers.current.values())
      const scale = pointerDistance(p1, p2) / pinch.current.distance
      setZoom(clampZoom(pinch.current.zoom * scale))
      return
    }

    if (isDragging) {
      setPan(clampPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y }))
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (pointers.current.size === 1 && !pinch.current && zoom <= 1) {
      resolveSwipe(e)
    }
    pointers.current.delete(e.pointerId)
    swipeStart.current = null
    if (pointers.current.size < 2) pinch.current = null
    setIsDragging(false)
  }

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    pointers.current.delete(e.pointerId)
    swipeStart.current = null
    if (pointers.current.size < 2) pinch.current = null
    setIsDragging(false)
  }

  // Lightweight swipe-only handlers for the non-fullscreen preview -- no
  // zoom/pinch there, just enough to flip photos with a horizontal swipe
  // while leaving vertical touch scrolling of the page alone (see
  // touch-pan-y below). Unlike the fullscreen viewer, this also tracks the
  // drag live (dragOffset) so the strip visibly follows the finger/cursor
  // rather than only snapping once the gesture is already over.
  const handlePreviewPointerDown = (e: React.PointerEvent) => {
    swipeStart.current = { x: e.clientX, y: e.clientY }
    setPreviewDragging(true)
  }
  const handlePreviewPointerMove = (e: React.PointerEvent) => {
    if (!swipeStart.current) return
    const dx = e.clientX - swipeStart.current.x
    const dy = e.clientY - swipeStart.current.y
    // Once a gesture reads as more vertical than horizontal, back off and let
    // the browser's native touch-pan-y scrolling take over instead of fighting it.
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) return
    const atStart = index === 0
    const atEnd = index === images.length - 1
    // Rubber-band resistance past either end -- there's no neighboring slide
    // to reveal there, so a 1:1 drag would look like it's sliding into nothing.
    const pastEnd = (atStart && dx > 0) || (atEnd && dx < 0)
    setDragOffset(pastEnd ? dx * 0.35 : dx)
  }
  const handlePreviewPointerUp = (e: React.PointerEvent) => {
    resolveSwipe(e)
    setPreviewDragging(false)
    setDragOffset(0)
  }
  const handlePreviewPointerCancel = () => {
    swipeStart.current = null
    setPreviewDragging(false)
    setDragOffset(0)
  }

  useEffect(() => {
    if (!fullscreen) return

    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showGrid) setShowGrid(false)
        else setFullscreen(false)
        return
      }
      if (showGrid) return
      if (e.key === 'ArrowLeft') goTo(index - 1)
      if (e.key === 'ArrowRight') goTo(index + 1)
      if (e.key === '+' || e.key === '=') zoomIn()
      if (e.key === '-' || e.key === '_') zoomOut()
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [fullscreen, index, images.length, showGrid])

  useEffect(() => {
    // Attached as a native (non-passive) listener rather than React's onWheel
    // -- React registers wheel handlers as passive by default, which would
    // silently ignore preventDefault() and let the page scroll behind the
    // overlay while zooming.
    if (!fullscreen) return
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomBy(e.deltaY < 0 ? WHEEL_ZOOM_STEP : -WHEEL_ZOOM_STEP)
    }
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => el.removeEventListener('wheel', onWheel)
  }, [fullscreen])

  useEffect(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    pointers.current.clear()
    pinch.current = null
    swipeStart.current = null
    setFullscreenLoaded(false)
    setShowGrid(false)
    // Closing fullscreen (double-click/Escape/X) drops DOM focus back to
    // <body> instead of returning it here, which silently broke the arrow
    // keys until the preview was clicked again -- its ArrowLeft/ArrowRight
    // handler only fires while this element itself is focused.
    if (!fullscreen) previewRef.current?.focus()
  }, [index, fullscreen])

  useEffect(() => {
    if (zoom <= 1) {
      setPan({ x: 0, y: 0 })
      return
    }
    computeMaxPan(zoom)
    setPan((p) => clampPan(p))
  }, [zoom])

  return (
    <div className="w-full min-w-0">
      <div
        ref={previewRef}
        className="relative aspect-video print:aspect-[16/10] bg-surface-raised group touch-pan-y select-none overflow-hidden"
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') goTo(index - 1)
          if (e.key === 'ArrowRight') goTo(index + 1)
        }}
        onDoubleClick={() => images.length > 0 && setFullscreen(true)}
        onPointerDown={handlePreviewPointerDown}
        onPointerMove={handlePreviewPointerMove}
        onPointerUp={handlePreviewPointerUp}
        onPointerCancel={handlePreviewPointerCancel}
        tabIndex={images.length > 1 ? 0 : undefined}
      >
        {images.length > 0 ? (
          <div
            className="absolute inset-0 flex h-full"
            style={{
              transform: `translateX(calc(${-index * 100}% + ${dragOffset}px))`,
              transition: previewDragging ? 'none' : 'transform 300ms ease-out',
            }}
          >
            {images.map((img, i) => (
              <div key={img.id} className="relative w-full h-full shrink-0">
                <Image
                  // large_url (the resized/recompressed derivative), not the
                  // untouched original -- every slide in this carousel is
                  // mounted and loading at once (it's a sliding strip, not
                  // lazy per-slide), so using the full original here meant
                  // every listing page load was pulling down several
                  // multi-MB originals simultaneously. Full fidelity is
                  // reserved for the fullscreen zoomable lightbox below,
                  // where it's actually needed and only one photo loads at
                  // a time.
                  src={safeImageUrl(img.large_url, img.image_url)}
                  alt={`${title} — photo ${i + 1}`}
                  fill
                  // large_url is already a properly-sized (2400px cap),
                  // already-compressed WebP generated once at upload time --
                  // running it through Next's own image optimizer on top of
                  // that just adds a redundant resize/re-encode pass, which
                  // is genuinely slow (1s+) the first time any given photo
                  // is viewed at a given width, since nothing's cached yet.
                  // Serving it straight from CloudFront instead means it's
                  // never slow, at the cost of always sending the same
                  // ~2400px file regardless of viewport (an acceptable
                  // trade here: the file's already reasonably sized).
                  unoptimized
                  className="object-cover"
                  priority={i === index}
                  draggable={false}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Car className="w-16 h-16 text-muted" />
          </div>
        )}

        {statusBadge && <Badge label={statusBadge.label} variant={statusBadge.variant} className="absolute left-3 top-3" />}

        {images.length > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setFullscreen(true) }}
            onDoubleClick={(e) => e.stopPropagation()}
            aria-label={t('viewFullscreen')}
            className="group/btn absolute right-3 top-3 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer print:hidden"
          >
            <Maximize2 className="w-4 h-4" />
            <span className="pointer-events-none absolute right-0 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover/btn:opacity-100 transition-opacity z-10">
              {t('viewFullscreen')}
            </span>
          </button>
        )}

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goTo(index - 1) }}
              onDoubleClick={(e) => e.stopPropagation()}
              aria-label={t('previousPhoto')}
              className="group/btn absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer print:hidden"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="pointer-events-none absolute left-0 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover/btn:opacity-100 transition-opacity z-10">
                {t('previousPhoto')}
              </span>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); goTo(index + 1) }}
              onDoubleClick={(e) => e.stopPropagation()}
              aria-label={t('nextPhoto')}
              className="group/btn absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer print:hidden"
            >
              <ChevronRight className="w-5 h-5" />
              <span className="pointer-events-none absolute right-0 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover/btn:opacity-100 transition-opacity z-10">
                {t('nextPhoto')}
              </span>
            </button>
            <div className="absolute right-3 bottom-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full print:hidden">
              {index + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 p-3 overflow-x-auto w-full min-w-0 print:hidden">
          {images.map((img, i) => (
            <button
              type="button"
              key={img.id}
              onClick={() => setIndex(i)}
              aria-label={t('viewPhotoNumber', { index: i + 1 })}
              className={cn(
                'relative w-20 h-20 flex-shrink-0 rounded-md overflow-hidden border-2 transition-colors cursor-pointer',
                i === index ? 'border-primary' : 'border-border hover:border-muted'
              )}
            >
              <Image src={safeImageUrl(img.thumb_url, img.image_url)} alt={`${title} thumbnail ${i + 1}`} fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {fullscreen && images.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center select-none"
          onClick={() => setFullscreen(false)}
        >
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            aria-label={t('closeFullscreen')}
            className="group absolute right-4 top-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 cursor-pointer"
          >
            <X className="w-6 h-6" />
            <span className="pointer-events-none absolute right-0 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {t('closeFullscreen')}
            </span>
          </button>

          <div
            ref={containerRef}
            className={cn(
              'relative w-full h-full overflow-hidden touch-none select-none',
              zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : undefined
            )}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => { e.stopPropagation(); setFullscreen(false) }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          >
            <div
              className={cn('relative w-full h-full', !isDragging && 'transition-transform duration-200')}
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            >
              <Image
                // large_url, not the untouched original -- same reasoning as
                // the carousel above. This was the actual cause of the
                // multi-second first-load delay: even at quality=90 (not
                // 100), asking Next to resize/re-encode a multi-MB original
                // on the fly is genuinely slow, and it has to happen fresh
                // for every never-before-viewed width. large_url is already
                // a properly-sized, pre-compressed WebP with nothing left
                // for Next to usefully do to it -- see the pixel-diff
                // verification in this session's history, it's
                // indistinguishable from the original at normal viewing
                // sizes. unoptimized skips Next's processing entirely, so
                // this loads exactly as fast as CloudFront can serve it,
                // every time, not just after the first viewer eats the
                // cold-cache cost.
                src={safeImageUrl(images[index].large_url, images[index].image_url)}
                alt={`${title} — photo ${index + 1}`}
                fill
                unoptimized
                className={cn('object-contain pointer-events-none transition-opacity', fullscreenLoaded ? 'opacity-100' : 'opacity-0')}
                priority
                draggable={false}
                onLoad={() => setFullscreenLoaded(true)}
              />
              {!fullscreenLoaded && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Loader2 className="w-8 h-8 text-white/70 animate-spin" />
                </div>
              )}
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-10 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                zoomOut()
              }}
              disabled={zoom <= ZOOM_MIN}
              aria-label={t('zoomOut')}
              className="group relative bg-black/50 hover:bg-black/70 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full p-2 cursor-pointer"
            >
              <ZoomOut className="w-5 h-5" />
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {t('zoomOut')}
              </span>
            </button>
            {images.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowGrid(true)
                }}
                aria-label={t('viewAllPhotos')}
                className="bg-black/60 hover:bg-black/80 text-white text-xs px-2 py-1 rounded-full cursor-pointer transition-colors"
              >
                {index + 1} / {images.length}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                zoomIn()
              }}
              disabled={zoom >= ZOOM_MAX}
              aria-label={t('zoomIn')}
              className="group relative bg-black/50 hover:bg-black/70 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-full p-2 cursor-pointer"
            >
              <ZoomIn className="w-5 h-5" />
              <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {t('zoomIn')}
              </span>
            </button>
          </div>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  goTo(index - 1)
                }}
                aria-label={t('previousPhoto')}
                className="group absolute left-3 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
                <span className="pointer-events-none absolute left-0 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {t('previousPhoto')}
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  goTo(index + 1)
                }}
                aria-label={t('nextPhoto')}
                className="group absolute right-3 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-3 cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
                <span className="pointer-events-none absolute right-0 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {t('nextPhoto')}
                </span>
              </button>
            </>
          )}

          {showGrid && (
            <div
              className="absolute inset-0 z-20 bg-black/95 overflow-y-auto p-4 sm:p-6"
              onClick={(e) => { e.stopPropagation(); setShowGrid(false) }}
            >
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowGrid(false) }}
                aria-label={t('closeFullscreen')}
                className="absolute right-4 top-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
              <div
                className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-w-5xl mx-auto pt-12"
                onClick={(e) => e.stopPropagation()}
              >
                {images.map((img, i) => (
                  <button
                    type="button"
                    key={img.id}
                    onClick={() => { goTo(i); setShowGrid(false) }}
                    aria-label={t('viewPhotoNumber', { index: i + 1 })}
                    className={cn(
                      'relative aspect-square rounded-md overflow-hidden border-2 cursor-pointer transition-colors',
                      i === index ? 'border-primary' : 'border-transparent hover:border-white/50'
                    )}
                  >
                    <Image
                      src={safeImageUrl(img.thumb_url, img.image_url)}
                      alt={`${title} thumbnail ${i + 1}`}
                      fill
                      sizes="(min-width: 768px) 16vw, 33vw"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
