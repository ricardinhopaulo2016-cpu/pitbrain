import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, isSupabaseConfigured } from '@/lib/supabase'
import { getStorageMode } from '@/lib/storage/mode'
import { requireWorkspace, AuthRequiredError, WorkspaceRequiredError } from '@/lib/auth/get-current-user'

const SETTING_KEY = 'active_import_id'

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, storageMode: getStorageMode(), importId: null })
  }

  let workspaceId: string
  try {
    ;({ workspaceId } = await requireWorkspace())
  } catch (err) {
    return authErrorResponse(err)
  }

  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, storageMode: getStorageMode(), importId: null })
  }

  const { data, error } = await supabase
    .from('pitbrain_settings')
    .select('value')
    .eq('workspace_id', workspaceId)
    .eq('key', SETTING_KEY)
    .maybeSingle()

  if (error) {
    console.error('[api/settings/active-import GET]', error.message)
    return NextResponse.json({ ok: false, error: 'Erro ao buscar import ativo.' }, { status: 500 })
  }

  const importId = (data?.value as { importId?: string } | null)?.importId ?? null
  return NextResponse.json({ ok: true, storageMode: 'supabase', importId })
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, storageMode: getStorageMode() })
  }

  let workspaceId: string
  try {
    ;({ workspaceId } = await requireWorkspace())
  } catch (err) {
    return authErrorResponse(err)
  }

  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, storageMode: getStorageMode() })
  }

  const body = (await req.json()) as { importId: string | null }

  const { error } = await supabase.from('pitbrain_settings').upsert(
    {
      workspace_id: workspaceId,
      key: SETTING_KEY,
      value: { importId: body.importId ?? null },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,key' }
  )

  if (error) {
    console.error('[api/settings/active-import POST]', error.message)
    return NextResponse.json({ ok: false, error: 'Erro ao salvar import ativo.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, storageMode: 'supabase', importId: body.importId ?? null })
}

function authErrorResponse(err: unknown) {
  if (err instanceof AuthRequiredError) {
    return NextResponse.json({ ok: false, error: 'auth_required', message: err.message }, { status: 401 })
  }
  if (err instanceof WorkspaceRequiredError) {
    return NextResponse.json({ ok: false, error: 'workspace_required', message: err.message }, { status: 409 })
  }
  console.error('[api/settings/active-import]', err)
  return NextResponse.json({ ok: false, error: 'Erro inesperado de autenticação.' }, { status: 500 })
}
