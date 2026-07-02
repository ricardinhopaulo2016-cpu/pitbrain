'use client'

import { useState, useEffect } from 'react'
import { loadCurrentDataset, LastImport } from '@/lib/calculators/local-metrics'

export function useLastImport(): LastImport | null {
  // Always start null so the first client render matches the server-rendered
  // HTML — reading localStorage here would diverge from SSR and break hydration.
  const [lastImport, setLastImport] = useState<LastImport | null>(null)

  useEffect(() => {
    setLastImport(loadCurrentDataset())
  }, [])

  return lastImport
}
