import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getStorageMode } from '@/lib/storage/mode'
import { rowToImport, importToRow } from '@/lib/storage/supabase-imports'
import type { PitbrainImport } from '@/types/pitbrain'

export async function GET() {
  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, storageMode: getStorageMode(), imports: [] })
  }

  const { data, error } = await supabase
    .from('pitbrain_imports')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[api/imports GET]', error.message)
    return NextResponse.json({ ok: false, error: 'Erro ao listar imports do Supabase.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, storageMode: 'supabase', imports: (data ?? []).map(rowToImport) })
}

export async function POST(req: NextRequest) {
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
    .upsert(importToRow(body), { onConflict: 'id' })
    .select('*')
    .single()

  if (error) {
    console.error('[api/imports POST]', error.message)
    return NextResponse.json({ ok: false, error: 'Erro ao salvar import no Supabase.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, storageMode: 'supabase', import: rowToImport(data) })
}
