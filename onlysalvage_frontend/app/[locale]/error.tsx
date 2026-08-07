'use client'

// Client component boundary (required by Next's error.tsx convention) --
// catches any render/data-fetching error thrown by a page or component
// below this point in the tree, instead of crashing to Next's blank default
// error screen. Kept deliberately simple (no next-intl, minimal component
// imports) so a broken translation/provider isn't also what's failing here.

import { useEffect } from 'react'

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Replace with real error-tracking (Sentry or equivalent) once one is
    // wired up -- for now this at least lands in the gunicorn/Next.js
    // process's own stdout, which journald captures in production.
    console.error(error)
  }, [error])

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
      <p className="text-muted max-w-md">
        We hit an unexpected error loading this page. Try again, or head back to the homepage.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 rounded-md bg-primary-light text-white text-sm font-medium cursor-pointer hover:bg-primary-hover transition-colors"
        >
          Try again
        </button>
        <a
          href="/"
          className="px-4 py-2 rounded-md border border-border text-sm font-medium text-foreground hover:bg-surface-raised transition-colors"
        >
          Go home
        </a>
      </div>
    </div>
  )
}
