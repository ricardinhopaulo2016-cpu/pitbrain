'use client'

import { useState } from 'react'
import { useSessionStore } from '@/store/sessionStore'
import { parseUtmifyFile } from '@/lib/parsers/utmify-parser'
import {
  buildImportSummary,
  saveCurrentDataset,
  generateFileHash,
  loadImportHistory,
  addToImportHistory,
  LastImport,
} from '@/lib/calculators/local-metrics'
import { buildPitbrainImport } from '@/lib/storage/imports'
import { saveImport, setActiveImportId, getStorageMode } from '@/lib/storage/pitbrain-storage'
import type { ImportSession } from '@/types/import'
import type { UtmifyDailyRow, UtmifySession } from '@/types/utmify'

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error' | 'duplicate'

interface UploadResult {
  sessionId: string
  metaCount: number
  metaSourceType: string | null
  utmifyCount: number
  utmifySourceType: string | null
  warnings: string[]
  utmifyMissingColumns: string[]
}

export function useUpload() {
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [result, setResult] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [duplicateSession, setDuplicateSession] = useState<ImportSession | null>(null)
  const { setSessionId, reset } = useSessionStore()

  async function upload(utmifyFile: File | null, opts: { force?: boolean } = {}) {
    if (!utmifyFile) {
      setError('Selecione um arquivo da UTMify.')
      return
    }

    setStatus('uploading')
    setError(null)
    setDuplicateSession(null)

    try {
      const parseResult = await parseUtmifyFile(utmifyFile).catch(err => {
        console.error('[pitbrain] Client-side parse failed:', err)
        return null
      })

      if (!parseResult || parseResult.rows.length === 0) {
        setError('Não foi possível processar o arquivo. Verifique o formato (CSV, XLSX ou XLS da UTMify).')
        setStatus('error')
        return
      }

      const fileHash = await generateFileHash(utmifyFile)

      if (!opts.force) {
        const history = loadImportHistory()
        const dup = history.find(h => h.fileHash === fileHash)
        if (dup) {
          setDuplicateSession(dup)
          setStatus('duplicate')
          return
        }
      }

      const summary   = buildImportSummary(parseResult)
      const dateRange = extractDateRange(utmifyFile.name, parseResult)

      const pitbrainImport = buildPitbrainImport({
        parseResult,
        fileName: utmifyFile.name,
        fileHash,
        summary,
        dateRange,
      })

      // Persists to Supabase when configured, falls back to localStorage otherwise
      const { saved } = await saveImport(pitbrainImport)
      await setActiveImportId(saved.id)

      // Keep pitbrain:currentDataset in sync so useMetrics keeps working either way
      const lastImport: LastImport = {
        sourceType:   parseResult.sourceType,
        fileName:     utmifyFile.name,
        importedAt:   saved.createdAt,
        rows:         parseResult.rows as LastImport['rows'],
        summary,
        fileHash,
        importMode:   'replace_current',
        ...(parseResult.sourceType === 'utmify_utm_breakdown' ? {
          breakdownLevel:         parseResult.breakdownLevel,
          dimensionField:         parseResult.dimensionField,
          dimensionLabel:         parseResult.dimensionLabel,
          ignoredFooterRowsCount: parseResult.ignoredFooterRowsCount,
        } : {}),
      }
      saveCurrentDataset(lastImport)

      // Keep legacy import history for duplicate detection
      addToImportHistory({
        id:          saved.id,
        fileName:    utmifyFile.name,
        fileHash,
        sourceType:  parseResult.sourceType,
        importedAt:  saved.createdAt,
        rowCount:    parseResult.rows.length,
        dateRange:   dateRange,
        mode:        'replace_current',
        hasStoredData: true,
      })

      reset()
      const sessionId = `local:${saved.id}`
      setSessionId(sessionId)
      setResult({
        sessionId,
        metaCount: 0,
        metaSourceType: null,
        utmifyCount: parseResult.rows.length,
        utmifySourceType: parseResult.sourceType,
        warnings: [],
        utmifyMissingColumns: [],
      })
      setStatus('success')
    } catch {
      setError('Falha de rede. Tente novamente.')
      setStatus('error')
    }
  }

  async function forceUpload(utmifyFile: File | null) {
    return upload(utmifyFile, { force: true })
  }

  function resetUpload() {
    setStatus('idle')
    setResult(null)
    setError(null)
    setDuplicateSession(null)
  }

  return {
    upload,
    forceUpload,
    status,
    result,
    error,
    reset: resetUpload,
    duplicateSession,
    storageMode: getStorageMode(),
  }
}

function extractDateRange(
  fileName: string,
  parseResult: NonNullable<Awaited<ReturnType<typeof parseUtmifyFile>>>
): { start: string; end: string } | undefined {
  if (parseResult.sourceType === 'utmify_daily_aggregate') {
    const rows = parseResult.rows as UtmifyDailyRow[]
    const dates = rows.map(r => r.date).filter((d): d is string => !!d).sort()
    if (!dates.length) return undefined
    return { start: dates[0], end: dates[dates.length - 1] }
  }
  if (parseResult.sourceType === 'utmify_orders') {
    const rows = parseResult.rows as UtmifySession[]
    const dates = rows.map(r => r.orderDate).filter((d): d is string => !!d).sort()
    if (!dates.length) return undefined
    return { start: dates[0], end: dates[dates.length - 1] }
  }
  return undefined
}
