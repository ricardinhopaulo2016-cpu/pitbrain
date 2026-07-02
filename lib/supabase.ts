import { createClient, SupabaseClient } from '@supabase/supabase-js'

let cachedClient: SupabaseClient | null | undefined

/**
 * Lazy, build-safe Supabase client. Returns null when env vars are missing
 * instead of throwing, so builds/deploys without Supabase configured don't break.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    cachedClient = null
    return cachedClient
  }

  cachedClient = createClient(supabaseUrl, supabaseServiceKey)
  return cachedClient
}
