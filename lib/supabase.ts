import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Browser client (limited permissions)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server client (full permissions — use only in API routes)
export function createServerClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}
