'use client'

import { useState } from 'react'
import { SummaryMetrics } from '@/types/metrics'
import { DiagnosisResponse } from '@/types/diagnosis'
import { useSessionStore } from '@/store/sessionStore'

export function useDiagnosis() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { sessionId, diagnosis, setDiagnosis } = useSessionStore()

  async function analyze(metrics: SummaryMetrics) {
    if (!sessionId) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, metrics }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao analisar.')
        setLoading(false)
        return
      }
      setDiagnosis(data as DiagnosisResponse)
      setLoading(false)
    } catch {
      setError('Falha de rede.')
      setLoading(false)
    }
  }

  return { analyze, diagnosis, loading, error }
}
