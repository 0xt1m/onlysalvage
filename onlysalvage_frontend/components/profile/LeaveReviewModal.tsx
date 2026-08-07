'use client'

import { useEffect, useState } from 'react'
import { useRouter } from '@/i18n/navigation'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Star, X, MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getMySellerReview, submitSellerReview } from '@/lib/api'
import { cn } from '@/lib/utils'

interface LeaveReviewDialogProps {
  username: string
  onClose: () => void
}

// Controlled dialog -- both the "Leave a Review" button on a seller's own
// profile page (LeaveReviewModal below) and a seller card's right-click
// menu open this same dialog, just from different triggers.
export function LeaveReviewDialog({ username, onClose }: LeaveReviewDialogProps) {
  const t = useTranslations('LeaveReviewModal')
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    getMySellerReview(username).then((existing) => {
      if (existing) {
        setRating(existing.rating)
        setComment(existing.comment)
      }
      setLoading(false)
    })
  }, [username])

  const close = () => {
    if (submitting) return
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rating < 1) {
      setError(t('ratingRequired'))
      return
    }

    setSubmitting(true)
    const result = await submitSellerReview(username, rating, comment.trim())
    setSubmitting(false)

    if (!result.ok) {
      toast.error(t('submitFailed'))
      return
    }

    toast.success(t('submitSucceeded'))
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface border border-border rounded-lg w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('leaveReview')}</h3>
          <button onClick={close} className="relative group text-muted hover:text-foreground cursor-pointer" aria-label={t('close')}>
            <X className="w-5 h-5" />
            <span className="pointer-events-none absolute right-0 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
              {t('close')}
            </span>
          </button>
        </div>

        {loading ? (
          <div className="h-32 animate-pulse bg-muted/20 rounded-md" />
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-foreground">{t('ratingLabel')}</label>
              <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
                {[1, 2, 3, 4, 5].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={t('starAriaLabel', { value })}
                    onClick={() => { setRating(value); setError('') }}
                    onMouseEnter={() => setHoverRating(value)}
                    className="relative group cursor-pointer p-0.5"
                  >
                    <Star
                      className={cn(
                        'w-7 h-7 transition-colors',
                        (hoverRating || rating) >= value ? 'fill-warning text-warning' : 'text-border'
                      )}
                    />
                    <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
                      {t('starAriaLabel', { value })}
                    </span>
                  </button>
                ))}
              </div>
              {error && <p className="text-sm text-error">{error}</p>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm text-foreground">{t('commentLabel')}</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder={t('commentPlaceholder')}
                className="bg-surface border border-border rounded-md px-3 py-2 text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={close} disabled={submitting}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? t('submitting') : t('submitReview')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

interface LeaveReviewModalProps {
  username: string
}

export function LeaveReviewModal({ username }: LeaveReviewModalProps) {
  const t = useTranslations('LeaveReviewModal')
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="flex items-center gap-2">
        <MessageSquarePlus className="w-4 h-4" />
        {t('leaveReview')}
      </Button>

      {open && <LeaveReviewDialog username={username} onClose={() => setOpen(false)} />}
    </>
  )
}
