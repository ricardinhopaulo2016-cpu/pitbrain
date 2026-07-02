'use client'

import { useState, useEffect } from 'react'
import type { PitbrainImport } from '@/types/pitbrain'
import { getActiveImport } from '@/lib/storage/imports'

export function useActiveImport(): PitbrainImport | null {
  // Always start null so the first client render matches the server-rendered
  // HTML — reading localStorage here would diverge from SSR and break hydration.
  const [activeImport, setActiveImport] = useState<PitbrainImport | null>(null)

  useEffect(() => {
    setActiveImport(getActiveImport())
  }, [])

  return activeImport
}
