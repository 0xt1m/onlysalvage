'use client'

// Only fires if the ROOT layout itself throws (app/[locale]/layout.tsx acts
// as the de facto root here -- there's no separate app/layout.tsx). Must
// render its own <html>/<body> since it replaces everything, including
// whatever normally provides those -- no design-system components, no
// next-intl, nothing that could itself be part of what's broken.

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>Something went wrong</h1>
          <p style={{ color: '#888', marginBottom: '1.5rem' }}>Please try again in a moment.</p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem', background: '#1a6694', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
