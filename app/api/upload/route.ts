import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { parseMetaFileText } from '@/lib/parsers/meta-parser'
import { parseUtmifyCsv } from '@/lib/parsers/utmify-parser'

async function fileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    return XLSX.utils.sheet_to_csv(sheet)
  }
  return file.text()
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const metaFile = formData.get('meta') as File | null
    const utmifyFile = formData.get('utmify') as File | null

    if (!metaFile && !utmifyFile) {
      return NextResponse.json({ error: 'Envie ao menos um arquivo.' }, { status: 400 })
    }

    const supabase = createServerClient()

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({ status: 'processing' })
      .select('id')
      .single()

    if (sessionError || !session) {
      const detail = sessionError?.message ?? 'unknown'
      if (process.env.NODE_ENV === 'development') {
        console.error('[pitbrain:upload] session create failed:', detail)
      }
      return NextResponse.json({ error: 'Erro ao criar sessão.', detail }, { status: 500 })
    }

    const sessionId: string = session.id
    const warnings: string[] = []
    let metaCount = 0
    let metaSourceType: string | null = null
    let utmifyCount = 0
    let utmifyMissingColumns: string[] = []
    let utmifySourceType: string | null = null

    if (metaFile) {
      try {
        const text = await fileToText(metaFile)
        const parseResult = parseMetaFileText(text)
        metaSourceType = parseResult.sourceType
        metaCount = parseResult.rows.length

        if (process.env.NODE_ENV === 'development') {
          console.log('[pitbrain:upload] meta file', {
            fileName: metaFile.name,
            sourceType: metaSourceType,
            rowCount: metaCount,
            redirectRoute: metaSourceType === 'meta_ads_structure' ? '/estrutura' : '/dashboard',
          })
        }

        if (parseResult.rows.length === 0 && metaSourceType !== 'meta_ads_structure') {
          warnings.push('CSV do Meta Ads não gerou linhas válidas. Verifique o formato.')
        } else if (parseResult.rows.length > 0) {
          const { error } = await supabase.from('meta_rows').insert(
            parseResult.rows.map(r => ({ session_id: sessionId, payload: r }))
          )
          if (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('[pitbrain:upload] meta_rows insert failed:', error.message)
            }
            warnings.push('Erro ao salvar linhas do Meta Ads.')
          }
        }
      } catch (metaErr) {
        const msg = metaErr instanceof Error ? metaErr.message : String(metaErr)
        if (process.env.NODE_ENV === 'development') {
          console.error('[pitbrain:upload] meta parse error:', msg)
        }
        warnings.push(`Erro ao processar arquivo Meta Ads: ${msg}`)
      }
    }

    if (utmifyFile) {
      try {
        const text = await fileToText(utmifyFile)
        const parseResult = parseUtmifyCsv(text)

        utmifyCount = parseResult.rows.length
        utmifyMissingColumns = parseResult.missingColumns
        utmifySourceType = parseResult.sourceType

        if (process.env.NODE_ENV === 'development') {
          console.log('[pitbrain:upload] utmify file', {
            fileName: utmifyFile.name,
            sourceType: utmifySourceType,
            rowCount: utmifyCount,
          })
        }

        if (parseResult.rows.length === 0) {
          warnings.push(
            'Não conseguimos identificar dados válidos neste arquivo. Confira se ele é um relatório da UTMify ou export do Meta Ads.'
          )
        } else {
          const { error } = await supabase.from('utmify_rows').insert(
            parseResult.rows.map(r => ({ session_id: sessionId, payload: r }))
          )
          if (error) {
            if (process.env.NODE_ENV === 'development') {
              console.error('[pitbrain:upload] utmify_rows insert failed:', error.message)
            }
            warnings.push('Erro ao salvar linhas da UTMify.')
          }
        }
      } catch (utmErr) {
        const msg = utmErr instanceof Error ? utmErr.message : String(utmErr)
        if (process.env.NODE_ENV === 'development') {
          console.error('[pitbrain:upload] utmify parse error:', msg)
        }
        warnings.push(`Erro ao processar arquivo UTMify: ${msg}`)
      }
    }

    await supabase.from('sessions').update({ status: 'ready' }).eq('id', sessionId)

    return NextResponse.json({
      sessionId,
      metaCount,
      metaSourceType,
      utmifyCount,
      utmifySourceType,
      warnings,
      utmifyMissingColumns,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (process.env.NODE_ENV === 'development') {
      console.error('[pitbrain:upload] unhandled error:', msg)
    }
    return NextResponse.json({ error: 'Erro interno no servidor.', detail: msg }, { status: 500 })
  }
}
