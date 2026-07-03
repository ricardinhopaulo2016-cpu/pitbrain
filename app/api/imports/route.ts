import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, isSupabaseConfigured } from '@/lib/supabase'
import { getStorageMode } from '@/lib/storage/mode'
import { requireWorkspace, AuthRequiredError, WorkspaceRequiredError } from '@/lib/auth/get-current-user'
import { rowToImport, importToRow } from '@/lib/storage/supabase-imports'
import type { PitbrainImport } from '@/types/pitbrain'

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, storageMode: getStorageMode(), imports: [] })
  }

  let workspaceId: string
  try {
    ;({ workspaceId } = await requireWorkspace())
  } catch (err) {
    return authErrorResponse(err)
  }

  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, storageMode: getStorageMode(), imports: [] })
  }

  const { data, error } = await supabase
    .from('pitbrain_imports')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[api/imports GET]', error.message)
    return NextResponse.json({ ok: false, error: 'Erro ao listar imports do Supabase.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, storageMode: 'supabase', imports: (data ?? []).map(rowToImport) })
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      ok: false,
      storageMode: getStorageMode(),
      error: 'Supabase não configurado. Use o modo local.',
    })
  }

  let workspaceId: string
  let userId: string
  try {
    const ctx = await requireWorkspace()
    workspaceId = ctx.workspaceId
    userId = ctx.user.id
  } catch (err) {
    return authErrorResponse(err)
  }

  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({
      ok: false,
      storageMode: getStorageMode(),
      error: 'Supabase não configurado. Use o modo local.',
    })
  }

  const body = (await req.json()) as PitbrainImport
  if (!body?.name || !body?.sourceType || !body?.id) {
    return NextResponse.json({ ok: false, error: 'Payload de import inválido.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('pitbrain_imports')
    .upsert(importToRow(body, { workspaceId, createdBy: userId }), { onConflict: 'id' })
    .select('*')
    .single()

  if (error) {
    console.error('[api/imports POST]', error.message)
    return NextResponse.json({ ok: false, error: 'Erro ao salvar import no Supabase.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, storageMode: 'supabase', import: rowToImport(data) })
}

function authErrorResponse(err: unknown) {
  if (err instanceof AuthRequiredError) {
    return NextResponse.json({ ok: false, error: 'auth_required', message: err.message }, { status: 401 })
  }
  if (err instanceof WorkspaceRequiredError) {
    return NextResponse.json({ ok: false, error: 'workspace_required', message: err.message }, { status: 409 })
  }
  console.error('[api/imports]', err)
  return NextResponse.json({ ok: false, error: 'Erro inesperado de autenticação.' }, { status: 500 })
}
