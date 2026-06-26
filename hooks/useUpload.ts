'use client'

import { useState } from 'react'
import { useSessionStore } from '@/store/sessionStore'
import { parseUtmifyFile } from '@/lib/parsers/utmify-parser'
import { buildImportSummary, saveLastImport } from '@/lib/calculators/local-metrics'

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

interface UploadResult {
  sessionId: string
  metaCount: number
  utmifyCount: number
  utmifySourceType: string | null
  warnings: string[]
  utmifyMissingColumns: string[]
}

export function useUpload() {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { setSessionId, reset } = useSessionStore()

  async function upload(metaFile: File | null, utmifyFile: File | null) {
    setStatus('uploading')
    setError(null)

    const form = new FormData()
    if (metaFile) form.append('meta', metaFile)
    if (utmifyFile) form.append('utmify', utmifyFile)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Erro desconhecido.')
        setStatus('error')
        return
      }

      // Clear old session metrics so the dashboard reads fresh data
      reset()
      setSessionId(data.sessionId)

      // Parse UTMify file client-side and persist to localStorage
      if (utmifyFile) {
        try {
          const parseResult = await parseUtmifyFile(utmifyFile)
          if (parseResult.rows.length > 0) {
            const summary = buildImportSummary(parseResult)
            saveLastImport({
              sourceType: parseResult.sourceType,
              fileName: utmifyFile.name,
              importedAt: new Date().toISOString(),
              rows: parseResult.rows,
              summary,
            })
          }
        } catch (parseErr) {
          // localStorage save is best-effort — don't block the upload result
          console.error('[pitbrain] Client-side parse for localStorage failed:', parseErr)
        }
      }

      setResult(data as UploadResult)
      setStatus('success')
    } catch {
      setError('Falha de rede. Tente novamente.')
      setStatus('error')
    }
  }

  function resetUpload() {
    setStatus('idle')
    setResult(null)
    setError(null)
  }

  return { upload, status, result, error, reset: resetUpload }
}
