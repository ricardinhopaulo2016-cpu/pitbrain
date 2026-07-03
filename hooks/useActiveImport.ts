'use client'

import { useState, useEffect } from 'react'
import type { PitbrainImport } from '@/types/pitbrain'
import { getActiveImport } from '@/lib/storage/pitbrain-storage'
import { pitbrainImportToLastImport } from '@/lib/storage/imports'
import { saveCurrentDataset } from '@/lib/calculators/local-metrics'

export function useActiveImport(): PitbrainImport | null {
  // Always start null so the first client render matches the server-rendered
  // HTML — resolving storage here would diverge from SSR and break hydration.
  const [activeImport, setActiveImport] = useState<PitbrainImport | null>(null)

  useEffect(() => {
    let cancelled = false
    getActiveImport().then(imp => {
      if (cancelled) return
      setActiveImport(imp)
      // Keep pitbrain:currentDataset in sync so useMetrics/useLastImport keep working
      // unchanged, regardless of whether the import came from Supabase or localStorage.
      if (imp) saveCurrentDataset(pitbrainImportToLastImport(imp))
    })
    return () => { cancelled = true }
  }, [])

  return activeImport
}
