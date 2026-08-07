export interface CroppedAreaPixels {
  x: number
  y: number
  width: number
  height: number
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.crossOrigin = 'anonymous'
    img.src = src
  })
}

// Draws just the cropped region onto a canvas sized to the crop, and returns
// it as a File so it can be uploaded the same way the uncropped file was.
export async function getCroppedImageFile(
  imageSrc: string,
  cropPixels: CroppedAreaPixels,
  fileName: string,
  mimeType: string
): Promise<File> {
  const image = await loadImage(imageSrc)

  const canvas = document.createElement('canvas')
  canvas.width = cropPixels.width
  canvas.height = cropPixels.height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')

  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    cropPixels.width,
    cropPixels.height
  )

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas is empty'))), mimeType, 0.92)
  })

  return new File([blob], fileName, { type: mimeType })
}
