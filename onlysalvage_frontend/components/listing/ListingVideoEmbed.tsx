import { Play } from 'lucide-react'

// video_url (see inventory/models.py) is a plain URLField -- sellers just
// paste a link, nothing is uploaded/hosted by us -- so this has to work out
// what kind of link it is at render time: a YouTube/Vimeo page (embed via
// iframe), a direct video file (native <video>), or anything else (just a
// plain "watch" link, since we can't know how to embed an arbitrary page).

function getYouTubeEmbedUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^www\.|^m\./, '')

  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1)
    return id ? `https://www.youtube.com/embed/${id}` : null
  }
  if (host === 'youtube.com') {
    if (parsed.pathname === '/watch') {
      const id = parsed.searchParams.get('v')
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (parsed.pathname.startsWith('/shorts/')) {
      const id = parsed.pathname.split('/')[2]
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (parsed.pathname.startsWith('/embed/')) {
      return url
    }
  }
  return null
}

function getVimeoEmbedUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^www\./, '')
  if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null

  const id = parsed.pathname.match(/(\d+)/)?.[1]
  return id ? `https://player.vimeo.com/video/${id}` : null
}

// Covers both link shapes Google Drive's own "Share" dialog hands out --
// .../file/d/{id}/view?usp=sharing, and the older .../open?id={id}.
function getGoogleDriveEmbedUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^www\./, '')
  if (host !== 'drive.google.com') return null

  const pathId = parsed.pathname.match(/\/file\/d\/([^/]+)/)?.[1]
  const id = pathId ?? parsed.searchParams.get('id')
  return id ? `https://drive.google.com/file/d/${id}/preview` : null
}

function isDirectVideoFile(url: string): boolean {
  try {
    return /\.(mp4|webm|ogg|mov)$/i.test(new URL(url).pathname)
  } catch {
    return false
  }
}

export function ListingVideoEmbed({ url, watchLabel }: { url: string; watchLabel: string }) {
  const embedUrl = getYouTubeEmbedUrl(url) ?? getVimeoEmbedUrl(url) ?? getGoogleDriveEmbedUrl(url)

  if (embedUrl) {
    return (
      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  if (isDirectVideoFile(url)) {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption -- seller-provided link, no caption track available
      <video controls preload="metadata" className="w-full rounded-lg bg-black">
        <source src={url} />
      </video>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-primary-light hover:underline w-fit"
    >
      <Play className="w-4 h-4" />
      {watchLabel}
    </a>
  )
}
