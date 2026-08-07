'use client'

import { Check, FileText, Loader2, X } from 'lucide-react'
import { Dropzone } from '@/components/ui/Dropzone'

export type DocStatus = 'idle' | 'uploading' | 'done' | 'error'

function DocStatusBadge({ status, uploadingLabel, uploadedLabel, uploadFailedLabel }: {
  status: DocStatus
  uploadingLabel: string
  uploadedLabel: string
  uploadFailedLabel: string
}) {
  if (status === 'uploading') {
    return (
      <span className="flex items-center gap-1 text-xs text-muted shrink-0">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        {uploadingLabel}
      </span>
    )
  }
  if (status === 'done') {
    return (
      <span className="flex items-center gap-1 text-xs text-success shrink-0">
        <Check className="w-3.5 h-3.5" />
        {uploadedLabel}
      </span>
    )
  }
  if (status === 'error') {
    return <span className="text-xs text-error shrink-0">{uploadFailedLabel}</span>
  }
  return null
}

interface DocUploadSlotProps {
  inputId: string
  label: string
  file: File | null
  // Already-saved URL from a previous upload -- only ever set on the edit
  // form (a fresh sell form has nothing to link to yet).
  existingUrl?: string | null
  status: DocStatus
  // Sell form only: uploads can't start until the draft listing exists.
  locked?: boolean
  lockedMessage?: string
  onSelectFile: (file: File) => void
  onRemoveFile: () => void
  clickToSelectLabel: string
  removeLabel: string
  viewCurrentLabel?: string
  replaceLabel?: string
  uploadingLabel: string
  uploadedLabel: string
  uploadFailedLabel: string
}

// One column of the documents row shared by SellForm and EditListingForm --
// each doc type (Carfax/alignment/inspection) used to get its own full-width
// Card, which made three PDF uploaders take up as much vertical space as
// the entire rest of the form combined.
export function DocUploadSlot({
  inputId,
  label,
  file,
  existingUrl,
  status,
  locked = false,
  lockedMessage,
  onSelectFile,
  onRemoveFile,
  clickToSelectLabel,
  removeLabel,
  viewCurrentLabel,
  replaceLabel,
  uploadingLabel,
  uploadedLabel,
  uploadFailedLabel,
}: DocUploadSlotProps) {
  const replaceInputId = `${inputId}-replace`

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <h3 className="text-sm font-medium text-foreground">{label}</h3>
      {locked ? (
        <div className="flex items-center border border-dashed border-border rounded-lg p-3 text-xs text-muted min-h-[4.5rem]">
          {lockedMessage}
        </div>
      ) : file ? (
        <div className="flex items-center gap-2 border border-border rounded-lg p-2.5 min-w-0">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs text-foreground truncate flex-1 min-w-0">{file.name}</span>
          <DocStatusBadge status={status} uploadingLabel={uploadingLabel} uploadedLabel={uploadedLabel} uploadFailedLabel={uploadFailedLabel} />
          <button
            type="button"
            onClick={onRemoveFile}
            className="text-muted hover:text-foreground cursor-pointer shrink-0"
            aria-label={removeLabel}
            title={removeLabel}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : existingUrl ? (
        <div className="flex items-center gap-2 border border-border rounded-lg p-2.5 min-w-0">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <a href={existingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-light hover:underline flex-1 truncate min-w-0">
            {viewCurrentLabel}
          </a>
          <button
            type="button"
            onClick={() => document.getElementById(replaceInputId)?.click()}
            className="text-xs text-muted hover:text-foreground cursor-pointer shrink-0"
          >
            {replaceLabel}
          </button>
          <input
            id={replaceInputId}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) onSelectFile(e.target.files[0]) }}
          />
        </div>
      ) : (
        <Dropzone inputId={inputId} onFiles={(files) => { if (files[0]) onSelectFile(files[0]) }} accept="application/pdf" className="p-3 gap-1 min-h-[4.5rem] justify-center">
          <FileText className="w-5 h-5 text-muted" />
          <p className="text-muted text-xs text-center">{clickToSelectLabel}</p>
        </Dropzone>
      )}
    </div>
  )
}
