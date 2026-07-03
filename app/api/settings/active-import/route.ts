import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getStorageMode } from '@/lib/storage/mode'

const SETTING_ID = 'active_import_id'

export async function GET() {
  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, storageMode: getStorageMode(), importId: null })
  }

  const { data, error } = await supabase
    .from('pitbrain_settings')
    .select('value')
    .eq('id', SETTING_ID)
    .maybeSingle()

  if (error) {
    console.error('[api/settings/active-import GET]', error.message)
    return NextResponse.json({ ok: false, error: 'Erro ao buscar import ativo.' }, { status: 500 })
  }

  const importId = (data?.value as { importId?: string } | null)?.importId ?? null
  return NextResponse.json({ ok: true, storageMode: 'supabase', importId })
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json({ ok: false, storageMode: getStorageMode() })
  }

  const body = (await req.json()) as { importId: string | null }

  const { error } = await supabase.from('pitbrain_settings').upsert(
    {
      id: SETTING_ID,
      value: { importId: body.importId ?? null },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  if (error) {
    console.error('[api/settings/active-import POST]', error.message)
    return NextResponse.json({ ok: false, error: 'Erro ao salvar import ativo.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, storageMode: 'supabase', importId: body.importId ?? null })
}
