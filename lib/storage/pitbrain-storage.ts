'use client'

import { getStorageMode, type StorageMode } from '@/lib/storage/mode'
import {
  loadImports as loadLocalImports,
  saveImportToList as saveLocalImportToList,
  deleteImportById as deleteLocalImportById,
  renameImportById as renameLocalImportById,
  getActiveImportId as getLocalActiveImportId,
  setActiveImportId as setLocalActiveImportId,
  getActiveImport as getLocalActiveImport,
} from '@/lib/storage/imports'
import type { PitbrainImport, PitbrainImportPatch } from '@/types/pitbrain'

export type { StorageMode }
export { getStorageMode }

/**
 * Unified storage adapter: Supabase (workspace-scoped, requires login) when
 * configured, localStorage as fallback when it isn't. Every method degrades
 * gracefully to local storage if the API call fails for a reason other than
 * "you need to log in" (network error, misconfigured server env, etc.)
 */

function redirectToLogin() {
  if (typeof window !== 'undefined') {
    window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
  }
}

function isAuthRequired(data: unknown): boolean {
  return !!data && typeof data === 'object' && (data as Record<string, unknown>).error === 'auth_required'
}

export interface SupabaseHealth {
  ok: boolean
  configured: boolean
  tablesReady: boolean
  error?: string
}

export async function checkSupabaseHealth(): Promise<SupabaseHealth> {
  try {
    const res = await fetch('/api/supabase/health')
    return (await res.json()) as SupabaseHealth
  } catch {
    return { ok: false, configured: false, tablesReady: false }
  }
}

export async function listImports(): Promise<PitbrainImport[]> {
  if (getStorageMode() === 'supabase') {
    try {
      const res = await fetch('/api/imports')
      const data = await res.json()
      if (isAuthRequired(data)) { redirectToLogin(); return [] }
      if (data.ok && data.storageMode === 'supabase') return data.imports as PitbrainImport[]
    } catch {
      // network error — fall through to local as a safety net
    }
  }
  return loadLocalImports()
}

export async function getImport(id: string): Promise<PitbrainImport | null> {
  if (getStorageMode() === 'supabase') {
    try {
      const res = await fetch(`/api/imports/${id}`)
      const data = await res.json()
      if (isAuthRequired(data)) { redirectToLogin(); return null }
      if (data.ok && data.storageMode === 'supabase') return data.import as PitbrainImport
    } catch {
      // fall through to local
    }
  }
  return loadLocalImports().find(i => i.id === id) ?? null
}

export async function saveImport(imp: PitbrainImport): Promise<{ storageMode: StorageMode; saved: PitbrainImport }> {
  if (getStorageMode() === 'supabase') {
    try {
      const res = await fetch('/api/imports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(imp),
      })
      const data = await res.json()
      if (isAuthRequired(data)) { redirectToLogin(); return { storageMode: 'local', saved: imp } }
      if (data.ok && data.storageMode === 'supabase') {
        return { storageMode: 'supabase', saved: data.import as PitbrainImport }
      }
    } catch {
      // network error — fall through to local
    }
  }
  saveLocalImportToList(imp)
  return { storageMode: 'local', saved: imp }
}

export async function deleteImport(id: string): Promise<void> {
  if (getStorageMode() === 'supabase') {
    try {
      const res = await fetch(`/api/imports/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (isAuthRequired(data)) { redirectToLogin(); return }
      if (data.ok && data.storageMode === 'supabase') return
    } catch {
      // fall through to local
    }
  }
  deleteLocalImportById(id)
}

export async function updateImport(id: string, patch: PitbrainImportPatch): Promise<void> {
  if (getStorageMode() === 'supabase') {
    try {
      const res = await fetch(`/api/imports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (isAuthRequired(data)) { redirectToLogin(); return }
      if (data.ok && data.storageMode === 'supabase') return
    } catch {
      // fall through to local
    }
  }
  if (patch.name !== undefined) renameLocalImportById(id, patch.name)
}

export async function getActiveImportId(): Promise<string | null> {
  if (getStorageMode() === 'supabase') {
    try {
      const res = await fetch('/api/settings/active-import')
      const data = await res.json()
      if (isAuthRequired(data)) { redirectToLogin(); return null }
      if (data.ok && data.storageMode === 'supabase') return data.importId ?? null
    } catch {
      // fall through to local
    }
  }
  return getLocalActiveImportId()
}

export async function setActiveImportId(id: string | null): Promise<void> {
  if (getStorageMode() === 'supabase') {
    try {
      const res = await fetch('/api/settings/active-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importId: id }),
      })
      const data = await res.json()
      if (isAuthRequired(data)) { redirectToLogin(); return }
      if (data.ok && data.storageMode === 'supabase') return
    } catch {
      // fall through to local
    }
  }
  setLocalActiveImportId(id)
}

export async function getActiveImport(): Promise<PitbrainImport | null> {
  const id = await getActiveImportId()
  if (!id) return null
  return getImport(id)
}
