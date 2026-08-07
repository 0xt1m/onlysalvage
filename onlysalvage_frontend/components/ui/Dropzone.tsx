'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface DropzoneProps {
  inputId: string
  onFiles: (files: FileList) => void
  multiple?: boolean
  accept?: string
  className?: string
  children: React.ReactNode
}

// Wraps the existing "click to select" dropzone markup (already styled like
// a drop target with a dashed border) with real HTML5 drag-and-drop, so
// dragging files from the OS works the same as clicking through the file
// picker -- both end up calling the same onFiles(FileList).
export function Dropzone({ inputId, onFiles, multiple, accept, className, children }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  return (
    <div
      onClick={() => document.getElementById(inputId)?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        setIsDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files)
      }}
      className={cn(
        'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors flex flex-col items-center gap-2',
        isDragging ? 'border-primary-light bg-surface-raised' : 'border-border hover:bg-surface-raised',
        className
      )}
    >
      {children}
      <input
        id={inputId}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />
    </div>
  )
}
