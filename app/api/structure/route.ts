import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase'
import { getStorageMode } from '@/lib/storage/mode'
import { guardAuthorizedAccess } from '@/lib/auth/get-current-user'
import type { MetaCampaign } from '@/types/meta'
import { buildCampaignStructure } from '@/lib/parsers/structure-parser'

export async function GET(req: NextRequest) {
  const denied = await guardAuthorizedAccess()
  if (denied) return denied

  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId é obrigatório.' }, { status: 400 })
  }

  const supabase = getSupabaseAdminClient()
  if (!supabase) {
    return NextResponse.json(
      { ok: false, storageMode: getStorageMode(), error: 'Supabase não configurado. Use o modo local.' },
      { status: 200 }
    )
  }

  const { data, error } = await supabase
    .from('meta_rows')
    .select('payload')
    .eq('session_id', sessionId)

  if (error) {
    console.error('[structure]', error)
    return NextResponse.json({ error: 'Erro ao carregar dados do Meta Ads.' }, { status: 500 })
  }

  const rows = (data ?? []).map(r => r.payload as MetaCampaign)
  const structure = buildCampaignStructure(rows)

  return NextResponse.json(structure)
}
