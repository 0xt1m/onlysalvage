'use client'

import { useCallback, useEffect, useRef } from 'react'
import Script from 'next/script'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { useAuth } from '@/lib/auth-context'
import { useTheme } from '@/lib/theme-context'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string }) => void
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: { theme?: string; size?: string; type?: string; shape?: string }
          ) => void
        }
      }
    }
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

export function GoogleSignInButton() {
  const t = useTranslations('GoogleSignIn')
  const router = useRouter()
  const { loginWithGoogle } = useAuth()
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)

  const handleCredential = useCallback(async (response: { credential: string }) => {
    try {
      const profileComplete = await loginWithGoogle(response.credential)
      router.push(profileComplete ? '/' : '/complete-profile')
      // See LoginForm's identical call for why this is needed -- otherwise
      // a Router-Cache-stale destination page can render as if no one's
      // logged in.
      router.refresh()
    } catch {
      toast.error(t('signInFailed'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const renderGoogleButton = useCallback(() => {
    if (!GOOGLE_CLIENT_ID || !window.google || !containerRef.current) return
    // Google appends a fresh button on every call rather than updating the
    // existing one in place, so the container needs clearing first or a
    // theme change would leave both the old and new button stacked.
    containerRef.current.innerHTML = ''
    window.google.accounts.id.renderButton(containerRef.current, {
      // Icon-only (just the G, no label/width) -- meant to sit in a small
      // row of social-login icons (a Facebook one is coming later), not as
      // its own full-width "Continue with Google" button.
      type: 'icon',
      theme: theme === 'dark' ? 'filled_blue' : 'outline',
      size: 'large',
      shape: 'circle',
    })
  }, [theme])

  const handleScriptReady = () => {
    if (!GOOGLE_CLIENT_ID || !window.google || !containerRef.current) return
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredential,
    })
    initializedRef.current = true
    renderGoogleButton()
  }

  useEffect(() => {
    if (initializedRef.current) renderGoogleButton()
  }, [renderGoogleButton])

  if (!GOOGLE_CLIENT_ID) return null

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={handleScriptReady} />
      <div ref={containerRef} className="flex justify-center" />
    </>
  )
}
