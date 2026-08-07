'use client'

import { useCallback, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getCroppedImageFile, type CroppedAreaPixels } from '@/lib/cropImage'

interface ImageCropModalProps {
  imageSrc: string
  fileName: string
  mimeType: string
  onCancel: () => void
  onConfirm: (file: File) => void
}

export function ImageCropModal({ imageSrc, fileName, mimeType, onCancel, onConfirm }: ImageCropModalProps) {
  const t = useTranslations('ImageCropModal')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CroppedAreaPixels | null>(null)
  const [working, setWorking] = useState(false)

  const onCropComplete = useCallback((_croppedArea: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return
    setWorking(true)
    try {
      const file = await getCroppedImageFile(imageSrc, croppedAreaPixels, fileName, mimeType)
      onConfirm(file)
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-surface border border-border rounded-lg w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t('title')}</h3>
          <button onClick={onCancel} className="relative group text-muted hover:text-foreground cursor-pointer" aria-label={t('close')}>
            <X className="w-5 h-5" />
            <span className="pointer-events-none absolute right-0 top-full mt-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-50">
              {t('close')}
            </span>
          </button>
        </div>

        <p className="text-sm text-muted">{t('description')}</p>

        <div className="relative w-full aspect-square bg-surface-raised rounded-md overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted shrink-0">{t('zoom')}</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-primary-light"
            aria-label={t('zoom')}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={working}>
            {t('cancel')}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={working || !croppedAreaPixels}>
            {working ? t('applying') : t('usePhoto')}
          </Button>
        </div>
      </div>
    </div>
  )
}
