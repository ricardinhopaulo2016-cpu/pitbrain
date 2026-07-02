import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import type { MetaCampaign } from '@/types/meta'
import { buildCampaignStructure } from '@/lib/parsers/structure-parser'

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId é obrigatório.' }, { status: 400 })
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: 'Supabase não configurado. Configure as variáveis de ambiente ou use o modo local.' },
      { status: 503 }
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
