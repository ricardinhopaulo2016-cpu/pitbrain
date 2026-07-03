import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient, isSupabaseConfigured } from '@/lib/supabase'
import { getStorageMode } from '@/lib/storage/mode'
import { requireWorkspace, AuthRequiredError, WorkspaceRequiredError } from '@/lib/auth/get-current-user'
import { rowToImport, patchToRow } from '@/lib/storage/supabase-imports'
import type { PitbrainImportPatch } from '@/types/pitbrain'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params

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

  const { data, error } = await supabase
    .from('pitbrain_imports')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle()

  if (error) {
    console.error('[api/imports/[id] GET]', error.message)
    return NextResponse.json({ ok: false, error: 'Erro ao buscar import.' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ ok: false, error: 'Import não encontrado.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, storageMode: 'supabase', import: rowToImport(data) })
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

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

  const patch = (await req.json()) as PitbrainImportPatch
  const { data, error } = await supabase
    .from('pitbrain_imports')
    .update(patchToRow(patch))
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select('*')
    .single()

  if (error) {
    console.error('[api/imports/[id] PATCH]', error.message)
    return NextResponse.json({ ok: false, error: 'Erro ao atualizar import.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, storageMode: 'supabase', import: rowToImport(data) })
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params

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

  const { error } = await supabase
    .from('pitbrain_imports')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (error) {
    console.error('[api/imports/[id] DELETE]', error.message)
    return NextResponse.json({ ok: false, error: 'Erro ao excluir import.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, storageMode: 'supabase' })
}

function authErrorResponse(err: unknown) {
  if (err instanceof AuthRequiredError) {
    return NextResponse.json({ ok: false, error: 'auth_required', message: err.message }, { status: 401 })
  }
  if (err instanceof WorkspaceRequiredError) {
    return NextResponse.json({ ok: false, error: 'workspace_required', message: err.message }, { status: 409 })
  }
  console.error('[api/imports/[id]]', err)
  return NextResponse.json({ ok: false, error: 'Erro inesperado de autenticação.' }, { status: 500 })
}
