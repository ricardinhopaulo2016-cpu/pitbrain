'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SummaryMetrics } from '@/types/metrics'
import { DiagnosisResponse } from '@/types/diagnosis'

interface SessionState {
  sessionId: string | null
  metrics: SummaryMetrics | null
  diagnosis: DiagnosisResponse | null
  setSessionId: (id: string) => void
  setMetrics: (metrics: SummaryMetrics) => void
  setDiagnosis: (diagnosis: DiagnosisResponse) => void
  reset: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      sessionId: null,
      metrics: null,
      diagnosis: null,
      setSessionId: (id) => set({ sessionId: id }),
      setMetrics: (metrics) => set({ metrics }),
      setDiagnosis: (diagnosis) => set({ diagnosis }),
      reset: () => set({ sessionId: null, metrics: null, diagnosis: null }),
    }),
    { name: 'pitbrain-session' }
  )
)
