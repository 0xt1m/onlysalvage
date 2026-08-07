'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { likeListing, unlikeListing } from '@/lib/api'
import { isLocallyLiked, addLocalLike, removeLocalLike } from '@/lib/localWatchlist'

// Logged in: persisted server-side against the account (also updates the
// public likes_count). Logged out: persisted to this browser only, via
// localStorage, and never affects the public count.
export function useLikeToggle(listingId: number, serverLiked: boolean, serverLikesCount: number) {
  const { user, loading } = useAuth()
  const [liked, setLiked] = useState(serverLiked)
  const [likesCount, setLikesCount] = useState(serverLikesCount)

  useEffect(() => {
    if (loading) return
    setLiked(user ? serverLiked : isLocallyLiked(listingId))
  }, [loading, user, serverLiked, listingId])

  const toggle = async (next: boolean) => {
    setLiked(next)
    setLikesCount((prev) => prev + (next ? 1 : -1))

    if (user) {
      const result = next ? await likeListing(listingId) : await unlikeListing(listingId)
      if (!result) {
        // revert on failure
        setLiked(!next)
        setLikesCount((prev) => prev + (next ? -1 : 1))
        return
      }
      setLikesCount(result.likes_count)
    } else {
      if (next) addLocalLike(listingId)
      else removeLocalLike(listingId)
    }
  }

  return { liked, likesCount, toggle }
}
