'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSessionStore } from '@/store/sessionStore'
import type { StructureData } from '@/types/campaign-structure'

export function useCampaignStructure() {
  const { sessionId } = useSessionStore()
  const [structure, setStructure] = useState<StructureData | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const load = useCallback(async (sid: string) => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/structure?sessionId=${encodeURIComponent(sid)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erro ao carregar estrutura.')
        setLoading(false)
        return
      }
      setStructure(data as StructureData)
    } catch {
      setError('Falha de rede ao carregar estrutura.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (sessionId) load(sessionId)
    else { setStructure(null); setError(null) }
  }, [sessionId, load])

  function reload() {
    if (sessionId) load(sessionId)
  }

  return { structure, loading, error, reload }
}
