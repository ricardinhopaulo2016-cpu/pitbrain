export type StorageMode = 'local' | 'supabase'

/**
 * Client- and server-safe: only reads NEXT_PUBLIC_ vars (inlined at build time),
 * never the server-only SUPABASE_SERVICE_ROLE_KEY.
 */
export function getStorageMode(): StorageMode {
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return hasUrl && hasAnonKey ? 'supabase' : 'local'
}
