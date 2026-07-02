import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { callDiagnosis } from '@/lib/openai'
import { MissingAPIKeyError } from '@/lib/ai'
import { SummaryMetrics } from '@/types/metrics'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionId, metrics } = body as { sessionId: string; metrics: SummaryMetrics }

    if (!sessionId || !metrics) {
      return NextResponse.json({ error: 'sessionId e metrics são obrigatórios.' }, { status: 400 })
    }

    const diagnosis = await callDiagnosis(metrics)

    const supabase = getSupabaseClient()
    if (supabase) {
      await supabase
        .from('diagnoses')
        .upsert({ session_id: sessionId, payload: diagnosis }, { onConflict: 'session_id' })
    } else if (process.env.NODE_ENV === 'development') {
      console.warn('[analyze] Supabase não configurado — diagnóstico não foi persistido (apenas retornado).')
    }

    return NextResponse.json(diagnosis)
  } catch (err: unknown) {
    console.error('[analyze]', err)

    if (err instanceof MissingAPIKeyError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }

    const e = err as { status?: number; error?: { type?: string; message?: string } }
    const httpStatus = e?.status
    const apiErrMsg = (e?.error?.message ?? '').toLowerCase()

    const isBillingError =
      httpStatus === 429 ||
      httpStatus === 402 ||
      apiErrMsg.includes('credit') ||
      apiErrMsg.includes('quota') ||
      apiErrMsg.includes('billing') ||
      apiErrMsg.includes('insufficient')

    if (isBillingError) {
      return NextResponse.json(
        { error: 'O provedor de IA retornou erro de limite ou cobrança. Verifique créditos/API key.' },
        { status: 402 }
      )
    }
    if (httpStatus === 401 || apiErrMsg.includes('auth')) {
      return NextResponse.json(
        { error: 'Chave de API inválida. Verifique a variável AI_PROVIDER e a chave correspondente no .env.local.' },
        { status: 401 }
      )
    }

    return NextResponse.json({ error: 'Erro ao gerar diagnóstico com a IA.' }, { status: 500 })
  }
}
