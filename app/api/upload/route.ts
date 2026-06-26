import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { parseMetaCsv } from '@/lib/parsers/meta-parser'
import { parseUtmifyCsv } from '@/lib/parsers/utmify-parser'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const metaFile = formData.get('meta') as File | null
    const utmifyFile = formData.get('utmify') as File | null

    if (!metaFile && !utmifyFile) {
      return NextResponse.json({ error: 'Envie ao menos um arquivo CSV.' }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({ status: 'processing' })
      .select('id')
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Erro ao criar sessão.' }, { status: 500 })
    }

    const sessionId: string = session.id
    const warnings: string[] = []
    let metaCount = 0
    let utmifyCount = 0
    let utmifyMissingColumns: string[] = []

    if (metaFile) {
      const text = await metaFile.text()
      const rows = parseMetaCsv(text)
      metaCount = rows.length

      if (rows.length === 0) {
        warnings.push('CSV do Meta Ads não gerou linhas válidas. Verifique o formato.')
      } else {
        const { error } = await supabase.from('meta_rows').insert(
          rows.map(r => ({ session_id: sessionId, payload: r }))
        )
        if (error) warnings.push('Erro ao salvar linhas do Meta Ads.')
      }
    }

    if (utmifyFile) {
      const text = await utmifyFile.text()
      const { rows, missingColumns } = parseUtmifyCsv(text)
      utmifyCount = rows.length
      utmifyMissingColumns = missingColumns

      if (rows.length === 0) {
        warnings.push('CSV do UTMify não gerou linhas válidas. Verifique o formato.')
      } else {
        const { error } = await supabase.from('utmify_rows').insert(
          rows.map(r => ({ session_id: sessionId, payload: r }))
        )
        if (error) warnings.push('Erro ao salvar linhas do UTMify.')
      }
    }

    await supabase.from('sessions').update({ status: 'ready' }).eq('id', sessionId)

    return NextResponse.json({ sessionId, metaCount, utmifyCount, warnings, utmifyMissingColumns })
  } catch (err) {
    console.error('[upload]', err)
    return NextResponse.json({ error: 'Erro interno no servidor.' }, { status: 500 })
  }
}
