'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { CodeBlock } from './CodeBlock'
import { Link } from '@/i18n/navigation'
import { ENDPOINTS, type Lang } from './endpoints'

const METHOD_COLOR: Record<string, string> = {
  GET: 'text-success',
  POST: 'text-primary-light',
  PATCH: 'text-warning',
  DELETE: 'text-error',
}

const LANGUAGES: { id: Lang; label: string }[] = [
  { id: 'curl', label: 'cURL' },
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'php', label: 'PHP' },
]

// Rendered above every code snippet rather than once in the sidebar -- the
// selected language is still shared across every endpoint (lifted to
// DevelopersContent's own `lang` state), just controllable from wherever
// you're actually looking at a snippet instead of scrolling back up.
function LanguageTabs({ lang, onChange, label }: { lang: Lang; onChange: (l: Lang) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={label}>
      {LANGUAGES.map((l) => (
        <button
          key={l.id}
          type="button"
          role="tab"
          aria-selected={lang === l.id}
          onClick={() => onChange(l.id)}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer',
            lang === l.id ? 'bg-primary-light text-white' : 'bg-surface-raised text-muted hover:text-foreground'
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}

export function DevelopersContent() {
  const t = useTranslations('Developers')

  const [query, setQuery] = useState('')
  const [lang, setLang] = useState<Lang>('curl')
  const q = query.trim().toLowerCase()

  // Search narrows both the endpoint sections in the main column and their
  // entries in the sidebar's table of contents together, so what's visible
  // in one always matches the other -- unlike the general sections (getting
  // started, auth, lifecycle, notes), which are few and short enough to
  // always stay visible regardless of what's being searched for.
  const filteredEndpoints = useMemo(() => {
    if (!q) return ENDPOINTS
    return ENDPOINTS.filter((e) =>
      e.method.toLowerCase().includes(q) ||
      e.path.toLowerCase().includes(q) ||
      t(e.descKey).toLowerCase().includes(q) ||
      t(`${e.descKey}Title`).toLowerCase().includes(q)
    )
  }, [q, t])

  const GENERAL_TOC = [
    { id: 'getting-started', label: t('gettingStartedTitle') },
    { id: 'authentication', label: t('authTitle') },
    { id: 'lifecycle', label: t('lifecycleTitle') },
  ]

  return (
    <div className="flex flex-col lg:flex-row w-full gap-3">
      <Card className="w-full lg:basis-1/4 h-fit lg:sticky lg:top-26 lg:self-start gap-3">
        <Input
          placeholder={t('searchEndpoints')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          suffix={<Search className="w-4 h-4 text-muted" />}
        />

        <nav className="flex flex-col gap-0.5 max-h-[65vh] overflow-y-auto">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide px-1 mb-1">{t('tableOfContents')}</p>
          {GENERAL_TOC.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="block text-sm text-muted hover:text-primary-light px-1 py-1 rounded truncate transition-colors"
            >
              {item.label}
            </a>
          ))}

          <p className="text-xs font-semibold text-muted uppercase tracking-wide px-1 mt-2 mb-1">{t('endpointsTitle')}</p>
          {filteredEndpoints.length === 0 && (
            <p className="text-sm text-muted px-1">{t('noEndpointsFound')}</p>
          )}
          {filteredEndpoints.map((e) => (
            <a
              key={e.id}
              href={`#${e.id}`}
              className="flex items-baseline gap-1.5 text-sm px-1 py-1 rounded hover:bg-surface-raised transition-colors min-w-0"
            >
              <span className={cn('font-mono text-[10px] font-semibold shrink-0', METHOD_COLOR[e.method])}>{e.method}</span>
              <span className="text-muted truncate">{t(`${e.descKey}Title`)}</span>
            </a>
          ))}

          <a
            href="#notes"
            className="block text-sm text-muted hover:text-primary-light px-1 py-1 mt-2 rounded truncate transition-colors"
          >
            {t('miscTitle')}
          </a>
        </nav>
      </Card>

      <div className="flex flex-col gap-3 w-full lg:basis-3/4 min-w-0">
        <Card id="getting-started" className="gap-3 scroll-mt-26">
          <h2 className="text-lg font-semibold">{t('gettingStartedTitle')}</h2>
          <ol className="text-sm text-muted list-decimal list-inside flex flex-col gap-1.5">
            <li>{t('gettingStartedStep1')} <Link href="/settings#api" className="text-primary-light hover:underline">{t('gettingStartedStep1Link')}</Link>.</li>
            <li>{t('gettingStartedStep2')}</li>
            <li>{t('gettingStartedStep3')}</li>
            <li>{t('gettingStartedStep4')}</li>
          </ol>
        </Card>

        <Card id="authentication" className="gap-3 scroll-mt-26">
          <h2 className="text-lg font-semibold">{t('authTitle')}</h2>
          <p className="text-sm text-muted">{t('authDescription')}</p>
          <CodeBlock>{`Authorization: Bearer osk_your_token_here`}</CodeBlock>
          <p className="text-xs text-muted">{t('authNote')}</p>
        </Card>

        <Card id="lifecycle" className="gap-3 scroll-mt-26">
          <h2 className="text-lg font-semibold">{t('lifecycleTitle')}</h2>
          <p className="text-sm text-muted">{t('lifecycleDescription')}</p>
          <ol className="text-sm text-muted list-decimal list-inside flex flex-col gap-1.5">
            <li>{t('lifecycleStep1')}</li>
            <li>{t('lifecycleStep2')}</li>
            <li>{t('lifecycleStep3')}</li>
          </ol>
        </Card>

        <h2 className="text-lg font-semibold px-1">{t('endpointsTitle')}</h2>

        {filteredEndpoints.length === 0 && (
          <Card className="items-center text-center py-8">
            <p className="text-sm text-muted">{t('noEndpointsFound')}</p>
          </Card>
        )}

        {filteredEndpoints.map((e) => (
          <Card key={e.id} id={e.id} className="gap-3 scroll-mt-26">
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold text-foreground">{t(`${e.descKey}Title`)}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('font-mono text-xs font-bold', METHOD_COLOR[e.method])}>{e.method}</span>
                <span className="font-mono text-xs text-muted break-all">{e.path}</span>
              </div>
            </div>
            <p className="text-sm text-muted">{t(e.descKey)}</p>
            <LanguageTabs lang={lang} onChange={setLang} label={t('languageLabel')} />
            <CodeBlock>{e.snippets[lang]}</CodeBlock>
          </Card>
        ))}

        <Card id="notes" className="gap-3 scroll-mt-26">
          <h2 className="text-lg font-semibold">{t('miscTitle')}</h2>
          <ul className="text-sm text-muted list-disc list-inside flex flex-col gap-1.5">
            <li>{t('miscRateLimit')}</li>
            <li>{t('miscOwnership')}</li>
            <li>{t('miscErrors')}</li>
            <li>{t('miscPagination')}</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
