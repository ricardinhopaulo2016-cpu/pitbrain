'use client'

import { useState, useEffect } from 'react'
import { loadLastImport, LastImport } from '@/lib/calculators/local-metrics'

export function useLastImport(): LastImport | null {
  const [lastImport, setLastImport] = useState<LastImport | null>(null)
  useEffect(() => {
    setLastImport(loadLastImport())
  }, [])
  return lastImport
}
