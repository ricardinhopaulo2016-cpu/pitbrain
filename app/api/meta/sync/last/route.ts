import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, isSupabaseConfigured } from '@/lib/supabase'
import { getStorageMode } from '@/lib/storage/mode'
import { guardAuthorizedAccess, requireWorkspace, AuthRequiredError, WorkspaceRequiredError } from '@/lib/auth/get-current-user'

/** Latest checkpointed sync (complete or partial) for one ad account — powers "Usar último sync válido". */
export async function GET(req: NextRequest) {
  const denied = await guardAuthorizedAccess()
  if (denied) return denied

  const adAccountId = req.nextUrl.searchParams.get('adAccountId')
  if (!adAccountId) {
    return NextResponse.json({ error: 'adAccountId obrigatório.' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, storageMode: getStorageMode(), sync: null })
  }

  let workspaceId: string
  try {
    ;({ workspaceId } = await requireWorkspace())
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json({ ok: false, error: 'auth_required', message: err.message }, { status: 401 })
    }
    if (err instanceof WorkspaceRequiredError) {
      return NextResponse.json({ ok: false, error: 'workspace_required', message: err.message }, { status: 409 })
    }
    console.error('[api/meta/sync/last]', err)
    return NextResponse.json({ ok: false, error: 'Erro inesperado de autenticação.' }, { status: 500 })
  }

  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, storageMode: getStorageMode(), sync: null })
  }

  const { data, error } = await supabase
    .from('pitbrain_meta_syncs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('ad_account_id', adAccountId)
    .maybeSingle()

  if (error) {
    console.error('[api/meta/sync/last]', error.message)
    return NextResponse.json({ ok: false, error: 'Erro ao buscar último sync.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, storageMode: 'supabase', sync: data ?? null })
}
