'use client'

import { useEffect, useState } from 'react'
import { SummaryMetrics } from '@/types/metrics'
import { useSessionStore } from '@/store/sessionStore'
import { loadCurrentDataset, buildSummaryMetrics } from '@/lib/calculators/local-metrics'

export function useMetrics(sessionId?: string) {
  const { metrics, setMetrics, sessionId: storedSessionId } = useSessionStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugError, setDebugError] = useState<string | null>(null)

  const targetId = sessionId ?? storedSessionId

  useEffect(() => {
    // Already have metrics for this session — nothing to do
    if (metrics && metrics.sessionId === targetId) return

    // Try localStorage first (primary source for MVP)
    const lastImport = loadCurrentDataset()

    // Structure files have no performance metrics — don't call the API
    if (lastImport?.sourceType === 'meta_ads_structure') {
      return
    }

    if (lastImport && Array.isArray(lastImport.rows) && lastImport.rows.length > 0) {
      console.log('[pitbrain:useMetrics] Using localStorage data', {
        sourceType: lastImport.sourceType,
        rows: lastImport.rows.length,
        fileName: lastImport.fileName,
      })
      try {
        const summaryMetrics = buildSummaryMetrics(lastImport)
        const tagged: SummaryMetrics = targetId
          ? { ...summaryMetrics, sessionId: targetId }
          : summaryMetrics
        setMetrics(tagged)
        return
      } catch (buildErr) {
        const msg = buildErr instanceof Error ? buildErr.message : String(buildErr)
        console.error('[pitbrain:useMetrics] Failed to build metrics from localStorage:', msg)
        setDebugError(msg)
      }
    }

    // Fall back to API
    if (!targetId) return

    setLoading(true)
    fetch(`/api/metrics?sessionId=${targetId}`)
      .then(r => {
        if (!r.ok) throw new Error(`API ${r.status}: ${r.statusText}`)
        return r.json()
      })
      .then((data: SummaryMetrics) => {
        console.log('[pitbrain:useMetrics] Loaded from API', { sessionId: data.sessionId })
        setMetrics(data)
        setLoading(false)
      })
      .catch((err: Error) => {
        console.error('[pitbrain:useMetrics] API error:', err.message)
        setDebugError(err.message)
        setError('Não foi possível carregar os dados importados.')
        setLoading(false)
      })
  }, [targetId])

  return { metrics, loading, error, debugError }
}
