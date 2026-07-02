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
import {
  saveImportToList,
  setActiveImportId,
  buildPitbrainImport,
} from '@/lib/storage/imports'
import { getStorageMode } from '@/lib/storage/mode'
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

    const form = new FormData()
    form.append('utmify', utmifyFile)

    try {
      const [apiRes, parseResult] = await Promise.all([
        fetch('/api/upload', { method: 'POST', body: form }),
        parseUtmifyFile(utmifyFile).catch(err => {
          console.error('[pitbrain] Client-side parse failed:', err)
          return null
        }),
      ])

      const apiData = await apiRes.json()
      const isLocalFallback = apiData?.storageMode === 'local'

      // A real API failure — anything other than the expected "no Supabase, use local" response.
      if (!apiRes.ok && !isLocalFallback) {
        setError(apiData.error ?? 'Erro desconhecido.')
        setStatus('error')
        return
      }

      // Hash + duplicate check
      let fileHash = ''
      if (parseResult) {
        fileHash = await generateFileHash(utmifyFile)

        if (!opts.force) {
          const history = loadImportHistory()
          const dup = history.find(h => h.fileHash === fileHash)
          if (dup) {
            setDuplicateSession(dup)
            setStatus('duplicate')
            return
          }
        }
      }

      // Build and save the import (works regardless of Supabase availability)
      let localImportId: string | null = null
      if (parseResult && parseResult.rows.length > 0) {
        const summary   = buildImportSummary(parseResult)
        const dateRange = extractDateRange(utmifyFile.name, parseResult)

        // Save to new pitbrain:imports list
        const pitbrainImport = buildPitbrainImport({
          parseResult,
          fileName: utmifyFile.name,
          fileHash,
          summary,
          dateRange,
        })
        localImportId = pitbrainImport.id
        saveImportToList(pitbrainImport)
        setActiveImportId(pitbrainImport.id)

        // Keep pitbrain:currentDataset in sync so useMetrics keeps working
        const lastImport: LastImport = {
          sourceType:   parseResult.sourceType,
          fileName:     utmifyFile.name,
          importedAt:   pitbrainImport.createdAt,
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
          id:          pitbrainImport.id,
          fileName:    utmifyFile.name,
          fileHash,
          sourceType:  parseResult.sourceType,
          importedAt:  pitbrainImport.createdAt,
          rowCount:    parseResult.rows.length,
          dateRange:   dateRange,
          mode:        'replace_current',
          hasStoredData: true,
        })
      }

      reset()
      const resolvedSessionId = isLocalFallback && localImportId
        ? `local:${localImportId}`
        : apiData.sessionId
      setSessionId(resolvedSessionId)
      setResult(
        isLocalFallback
          ? {
              sessionId: resolvedSessionId,
              metaCount: 0,
              metaSourceType: null,
              utmifyCount: parseResult?.rows.length ?? 0,
              utmifySourceType: parseResult?.sourceType ?? null,
              warnings: [],
              utmifyMissingColumns: [],
            }
          : (apiData as UploadResult)
      )
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
