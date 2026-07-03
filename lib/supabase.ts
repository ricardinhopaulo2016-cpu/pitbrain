import { createClient, SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null | undefined
let cachedAdminClient: SupabaseClient | null | undefined

/**
 * Public, anon-key client. Safe to use client-side (browser) or server-side.
 * Returns null when env vars are missing instead of throwing, so builds/deploys
 * without Supabase configured don't break.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    cachedClient = null
    return cachedClient
  }

  cachedClient = createClient(supabaseUrl, supabaseAnonKey)
  return cachedClient
}

/**
 * Privileged, service-role client. Server-side only — throws if called in the browser.
 * Use this in API routes for writes/reads that must bypass RLS.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (typeof window !== 'undefined') {
    throw new Error('getSupabaseAdminClient() cannot be called in the browser — it would expose the service role key.')
  }

  if (cachedAdminClient !== undefined) return cachedAdminClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    cachedAdminClient = null
    return cachedAdminClient
  }

  cachedAdminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cachedAdminClient
}

/**
 * True when Supabase is fully configured for server-side persistence
 * (url + service role key). This is the source of truth API routes use
 * to decide between Supabase and the local-storage fallback.
 */
export function isSupabaseConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY
}
