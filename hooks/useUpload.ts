'use client'

import { useState } from 'react'
import { useSessionStore } from '@/store/sessionStore'

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
  const { setSessionId } = useSessionStore()

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

      setResult(data as UploadResult)
      setSessionId(data.sessionId)
      setStatus('success')
    } catch {
      setError('Falha de rede. Tente novamente.')
      setStatus('error')
    }
  }

  function reset() {
    setStatus('idle')
    setResult(null)
    setError(null)
  }

  return { upload, status, result, error, reset }
}
