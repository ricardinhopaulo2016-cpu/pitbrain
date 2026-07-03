import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getStorageMode } from '@/lib/storage/mode'
import { rowToImport, patchToRow } from '@/lib/storage/supabase-imports'
import type { PitbrainImportPatch } from '@/types/pitbrain'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params
  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, storageMode: getStorageMode() })
  }

  const { data, error } = await supabase.from('pitbrain_imports').select('*').eq('id', id).maybeSingle()

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
  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, storageMode: getStorageMode() })
  }

  const patch = (await req.json()) as PitbrainImportPatch
  const { data, error } = await supabase
    .from('pitbrain_imports')
    .update(patchToRow(patch))
    .eq('id', id)
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
  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, storageMode: getStorageMode() })
  }

  const { error } = await supabase.from('pitbrain_imports').delete().eq('id', id)

  if (error) {
    console.error('[api/imports/[id] DELETE]', error.message)
    return NextResponse.json({ ok: false, error: 'Erro ao excluir import.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, storageMode: 'supabase' })
}
