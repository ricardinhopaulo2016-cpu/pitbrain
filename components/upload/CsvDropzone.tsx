'use client'

import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Upload, X, FileText, CheckCircle2 } from 'lucide-react'

interface CsvDropzoneProps {
  label: string
  description?: string
  accept?: string
  acceptHint?: string
  onFileSelected: (file: File | null) => void
  selectedFile: File | null
}

export function CsvDropzone({
  label,
  description,
  accept = '.csv',
  acceptHint,
  onFileSelected,
  selectedFile,
}: CsvDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function isAccepted(file: File): boolean {
    const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
    return accept.split(',').some(a => a.trim() === ext)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && isAccepted(file)) onFileSelected(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onFileSelected(e.target.files?.[0] ?? null)
  }

  const hint = acceptHint ?? accept.split(',').map(a => a.trim()).join(', ')

  return (
    <div
      className={cn(
        'relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer group',
        dragging
          ? 'border-pb-purple bg-pb-purple/10'
          : selectedFile
            ? 'border-pb-green/50 bg-pb-green/5'
            : 'border-pb-border hover:border-pb-purple/50 hover:bg-pb-card-alt'
      )}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />

      {selectedFile ? (
        <div className="flex items-center justify-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-pb-green shrink-0" />
          <span className="text-sm font-medium text-pb-text truncate max-w-[180px]">{selectedFile.name}</span>
          <span className="text-xs text-pb-muted">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
          <button
            type="button"
            className="text-pb-muted hover:text-pb-red transition-colors ml-1"
            onClick={e => { e.stopPropagation(); onFileSelected(null) }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
            dragging ? 'bg-pb-purple/20' : 'bg-pb-card-alt group-hover:bg-pb-purple/10'
          )}>
            {dragging
              ? <Upload className="h-6 w-6 text-pb-purple" />
              : <FileText className="h-6 w-6 text-pb-muted group-hover:text-pb-purple transition-colors" />
            }
          </div>
          <div>
            <p className="font-semibold text-pb-text text-sm">{label}</p>
            {description && <p className="text-xs text-pb-muted mt-1">{description}</p>}
          </div>
          <p className="text-xs text-pb-border">Arraste um arquivo ou clique para selecionar</p>
          <p className="text-xs text-pb-border/70">{hint}</p>
        </div>
      )}
    </div>
  )
}
