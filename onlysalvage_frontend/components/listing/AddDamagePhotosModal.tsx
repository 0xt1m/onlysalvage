'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Check, ImagePlus, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dropzone } from '@/components/ui/Dropzone'
import { presignListingImage, uploadImageToS3, registerListingImage } from '@/lib/api'

interface AddDamagePhotosModalProps {
  listingId: number
  onClose: () => void
}

interface PendingPhoto {
  id: string
  file: File
  status: 'uploading' | 'done' | 'error'
}

// Opened straight from a listing card's right-click menu ("Add Damage
// Photos", only shown once a listing has none yet -- see ListingCard) --
// same presign/S3/register flow as the Sell/Edit forms' own before-repair
// photo upload, just without needing to navigate to the edit page first.
export function AddDamagePhotosModal({ listingId, onClose }: AddDamagePhotosModalProps) {
  const t = useTranslations('AddDamagePhotosModal')
  const router = useRouter()
  const [photos, setPhotos] = useState<PendingPhoto[]>([])

  const uploadOne = async (photo: PendingPhoto) => {
    try {
      const presign = await presignListingImage(listingId, photo.file.type || 'image/jpeg')
      if (!presign) throw new Error('presign failed')

      const uploaded = await uploadImageToS3(presign.upload.url, presign.upload.fields, photo.file)
      if (!uploaded) throw new Error('s3 upload failed')

      const registered = await registerListingImage(listingId, presign.s3_key, undefined, 'before_repair')
      if (!registered) throw new Error('register failed')

      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'done' } : p)))
    } catch {
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'error' } : p)))
    }
  }

  const addFiles = (files: FileList) => {
    const added = Array.from(files)
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => ({ id: crypto.randomUUID(), file: f, status: 'uploading' as const }))
    setPhotos((prev) => [...prev, ...added])
    added.forEach(uploadOne)
  }

  const uploading = photos.some((p) => p.status === 'uploading')
  const anyDone = photos.some((p) => p.status === 'done')

  const close = () => {
    if (uploading) return
    if (anyDone) router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
      <div
        className="bg-surface border border-border rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('title')}</h3>
          <button
            onClick={close}
            disabled={uploading}
            className="relative group text-muted hover:text-foreground cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={t('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-muted -mt-1">{t('description')}</p>

        <Dropzone inputId="add-damage-photos-input" onFiles={addFiles} multiple accept="image/*">
          <ImagePlus className="w-6 h-6 text-muted" />
          <p className="text-muted text-sm">{t('clickToSelectPhotos')}</p>
        </Dropzone>

        {photos.length > 0 && (
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {photos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate min-w-0">{p.file.name}</span>
                {p.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-muted shrink-0" />}
                {p.status === 'done' && <Check className="w-4 h-4 text-success shrink-0" />}
                {p.status === 'error' && <span className="text-error text-xs shrink-0">{t('uploadFailed')}</span>}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button type="button" variant="secondary" onClick={close} disabled={uploading}>
            {uploading ? t('uploading') : t('done')}
          </Button>
        </div>
      </div>
    </div>
  )
}
