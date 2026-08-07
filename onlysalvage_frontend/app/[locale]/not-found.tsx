// Server component -- Next renders this for any URL under a locale segment
// that doesn't match a route (including notFound() calls from a page, e.g.
// an unknown listing slug). Kept plain/untranslated for the same robustness
// reason as error.tsx: this needs to render even when whatever the visitor
// was trying to reach is broken.

export default function LocaleNotFound() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
      <p className="text-muted max-w-md">
        The page you're looking for doesn't exist, or may have moved.
      </p>
      <a
        href="/"
        className="px-4 py-2 rounded-md bg-primary-light text-white text-sm font-medium hover:bg-primary-hover transition-colors"
      >
        Go home
      </a>
    </div>
  )
}
