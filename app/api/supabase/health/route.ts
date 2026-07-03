import { NextResponse } from 'next/server'
import { getSupabaseAdminClient, isSupabaseConfigured } from '@/lib/supabase'

const REQUIRED_TABLES = [
  'pitbrain_imports',
  'pitbrain_settings',
  'pitbrain_workspaces',
  'pitbrain_profiles',
  'pitbrain_workspace_members',
]

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, configured: false, tablesReady: false })
  }

  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ ok: true, configured: false, tablesReady: false })
  }

  for (const table of REQUIRED_TABLES) {
    // A real row-returning select (not head:true) is required here — PostgREST's
    // HEAD/count-only path can report success even when its schema cache hasn't
    // picked up the table yet, which would make this check a false positive.
    const { error } = await supabase.from(table).select('id').limit(1)
    if (error) {
      const missingTable = error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message)
      if (missingTable) {
        return NextResponse.json({
          ok: true,
          configured: true,
          tablesReady: false,
          error: `Tabela "${table}" não está disponível. Rode supabase/schema.sql no SQL Editor e, se persistir, recarregue o schema cache do PostgREST (Settings → API → Reload schema).`,
        })
      }
      console.error('[api/supabase/health]', table, error.message)
      return NextResponse.json({
        ok: false,
        configured: true,
        tablesReady: false,
        error: 'Erro inesperado ao verificar o schema do Supabase.',
      })
    }
  }

  return NextResponse.json({ ok: true, configured: true, tablesReady: true })
}
