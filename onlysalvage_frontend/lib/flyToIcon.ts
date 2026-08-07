// Small "fly to the nav icon" confirmation, fired whenever something gets
// added to compare or the watchlist -- a plain DOM node animated via the Web
// Animations API rather than React state, since it's a fire-and-forget
// visual effect with nothing to re-render for and no reason to survive the
// component that triggered it (e.g. a listing card can unmount mid-flight
// and the shape should keep flying regardless).
const SIZE = 10

interface FlyToIconOptions {
  originX: number
  originY: number
  // CSS selector for the nav icon to fly toward (e.g. the compare or
  // watchlist IconButton, each tagged with its own data-* attribute).
  targetSelector: string
  shape?: 'circle' | 'square'
}

export function flyToIcon({ originX, originY, targetSelector, shape = 'circle' }: FlyToIconOptions) {
  if (typeof window === 'undefined') return

  const target = document.querySelector(targetSelector)
  if (!target) return

  const targetRect = target.getBoundingClientRect()
  // Nothing to animate toward if the nav icon isn't actually on screen (e.g.
  // the mobile menu, which doesn't render the desktop icon row at all).
  if (targetRect.width === 0 && targetRect.height === 0) return

  const targetX = targetRect.left + targetRect.width / 2
  const targetY = targetRect.top + targetRect.height / 2

  const el = document.createElement('div')
  el.style.position = 'fixed'
  el.style.left = '0'
  el.style.top = '0'
  el.style.width = `${SIZE}px`
  el.style.height = `${SIZE}px`
  el.style.borderRadius = shape === 'circle' ? '9999px' : '2px'
  // --foreground is dark navy in light mode, near-white in dark mode -- i.e.
  // exactly "dark on light, light on dark" without a second color to track.
  el.style.backgroundColor = 'var(--foreground)'
  el.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.35)'
  el.style.pointerEvents = 'none'
  el.style.zIndex = '9999'
  document.body.appendChild(el)

  const at = (x: number, y: number) => `translate(${x - SIZE / 2}px, ${y - SIZE / 2}px)`
  // A point 30% of the way from origin to target -- strictly between the
  // two (never above the target's own height, unlike an arc peak positioned
  // by a fixed offset), so the path only ever heads toward the nav icon
  // instead of overshooting past it and doubling back.
  const liftX = originX + (targetX - originX) * 0.3
  const liftY = originY + (targetY - originY) * 0.3

  const animation = el.animate(
    [
      // Phase 1: a slow, small lift, like it's easing its way out of the
      // listing before committing to the throw.
      { transform: `${at(originX, originY)} scale(1)`, opacity: 1, easing: 'cubic-bezier(0.6, 0.04, 0.98, 0.34)' },
      { transform: `${at(liftX, liftY)} scale(1.05)`, opacity: 1, offset: 0.35, easing: 'cubic-bezier(0.34, 1.2, 0.64, 1)' },
      // Phase 2: springs the rest of the way to the icon -- the easing
      // above (a "back" curve) is what gives this its slight overshoot-and-
      // settle snap right at arrival instead of just gliding to a stop.
      { transform: `${at(targetX, targetY)} scale(0.3)`, opacity: 0.4 },
    ],
    { duration: 750 }
  )

  const cleanup = () => el.remove()
  animation.onfinish = cleanup
  animation.oncancel = cleanup
}

export const COMPARE_NAV_ICON_SELECTOR = '[data-compare-nav-icon]'
export const WATCHLIST_NAV_ICON_SELECTOR = '[data-watchlist-nav-icon]'

export function flyToCompareIcon(originX: number, originY: number) {
  flyToIcon({ originX, originY, targetSelector: COMPARE_NAV_ICON_SELECTOR, shape: 'circle' })
}

export function flyToWatchlistIcon(originX: number, originY: number) {
  flyToIcon({ originX, originY, targetSelector: WATCHLIST_NAV_ICON_SELECTOR, shape: 'square' })
}
