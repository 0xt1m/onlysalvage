'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Download, FileUp, Loader2, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Link } from '@/i18n/navigation'
import { useAuth } from '@/lib/auth-context'
import { bulkImportListings, downloadBulkImportTemplate } from '@/lib/api'
import type { BulkImportResponse } from '@/lib/types'

export function BulkUploadForm() {
  const t = useTranslations('SellBulk')
  const { user } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [result, setResult] = useState<BulkImportResponse | null>(null)

  const handleDownloadTemplate = async () => {
    setDownloading(true)
    const ok = await downloadBulkImportTemplate()
    setDownloading(false)
    if (!ok) toast.error(t('templateDownloadFailed'))
  }

  const handleSubmit = async () => {
    if (!file) return

    setUploading(true)
    setResult(null)

    const { ok, data } = await bulkImportListings(file)
    setUploading(false)

    if (!ok || !data || !('results' in data)) {
      const message = (data && 'detail' in data && data.detail) || t('importFailed')
      toast.error(message)
      return
    }

    setResult(data)
    setFile(null)
    if (inputRef.current) inputRef.current.value = ''

    if (data.imported > 0) {
      toast.success(t('importSummary', { imported: data.imported, total: data.total }))
    } else {
      toast.error(t('importSummaryNone', { total: data.total }))
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('uploadTitle')}</h2>
          <p className="text-sm text-muted">{t('uploadDescription')}</p>
        </div>
        <Button variant="secondary" onClick={handleDownloadTemplate} disabled={downloading}>
          <span className="inline-flex items-center gap-2">
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {t('downloadTemplate')}
          </span>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-foreground file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary-light file:text-white file:cursor-pointer file:text-sm cursor-pointer"
        />
        <Button onClick={handleSubmit} disabled={!file || uploading}>
          <span className="inline-flex items-center gap-2">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
            {uploading ? t('importing') : t('importButton')}
          </span>
        </Button>
      </div>

      {result && (
        <div className="flex flex-col gap-3 pt-2 border-t border-border">
          <p className="text-sm font-medium text-foreground">
            {t('importSummary', { imported: result.imported, total: result.total })}
          </p>

          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left text-muted border-b border-border">
                  <th className="py-2 px-2 font-medium">{t('colRow')}</th>
                  <th className="py-2 px-2 font-medium">{t('colVin')}</th>
                  <th className="py-2 px-2 font-medium">{t('colStatus')}</th>
                  <th className="py-2 px-2 font-medium">{t('colDetails')}</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((r) => (
                  <tr key={r.row} className="border-b border-border/50 align-top">
                    <td className="py-2 px-2 text-muted">{r.row}</td>
                    <td className="py-2 px-2 font-mono text-xs whitespace-nowrap">{r.vin || '—'}</td>
                    <td className="py-2 px-2 whitespace-nowrap">
                      {r.success ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <CheckCircle2 className="w-4 h-4" /> {t('imported')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-error">
                          <XCircle className="w-4 h-4" /> {t('failed')}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-muted">
                      {r.success && r.listing ? (
                        <Link href={`/inventory/${r.listing.slug}/edit`} className="text-primary-light hover:underline">
                          {t('reviewDraft')}
                        </Link>
                      ) : (
                        <ul className="list-disc list-inside space-y-0.5">
                          {Object.entries(r.errors ?? {}).map(([field, message]) => (
                            <li key={field}>
                              {field !== 'non_field_errors' && <span className="font-medium">{field}: </span>}
                              {message}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.imported > 0 && user && (
            <Link href={`/profile/${user.username}#drafts`} className="w-fit">
              <Button variant="secondary">{t('goToDrafts')}</Button>
            </Link>
          )}
        </div>
      )}
    </Card>
  )
}
