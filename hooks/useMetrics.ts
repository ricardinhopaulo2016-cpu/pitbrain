'use client'

import { useEffect, useState } from 'react'
import { SummaryMetrics } from '@/types/metrics'
import { useSessionStore } from '@/store/sessionStore'

export function useMetrics(sessionId?: string) {
  const { metrics, setMetrics } = useSessionStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const targetId = sessionId ?? useSessionStore.getState().sessionId

  useEffect(() => {
    if (!targetId) return
    if (metrics?.sessionId === targetId) return // already loaded

    setLoading(true)
    fetch(`/api/metrics?sessionId=${targetId}`)
      .then(r => r.json())
      .then((data: SummaryMetrics) => {
        setMetrics(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Erro ao carregar métricas.')
        setLoading(false)
      })
  }, [targetId])

  return { metrics, loading, error }
}
