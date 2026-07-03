import { NextRequest, NextResponse } from 'next/server'
import { guardAuthorizedAccess } from '@/lib/auth/get-current-user'
import { callReadOnlyTool } from '@/lib/utmify-mcp/utmify-mcp-service'
import { utmifyMcpErrorResponse } from '@/lib/utmify-mcp/utmify-mcp-errors'
import { normalizeUtmifyAdObjects, type UtmifyMcpLevel, type UtmifyMcpPlatform } from '@/lib/utmify-mcp/utmify-mcp-normalizers'

const VALID_LEVELS: UtmifyMcpLevel[] = ['all', 'account', 'campaign', 'adset', 'ad']
const PLATFORM_TOOL: Record<UtmifyMcpPlatform, string> = {
  meta: 'get_meta_ad_objects',
  google: 'get_google_ad_objects',
  kwai: 'get_kwai_ad_objects',
  tiktok: 'get_tiktok_ad_objects',
}

interface AdObjectsBody {
  dashboardId?: string
  platform?: string
  level?: string
  period?: { start?: string; end?: string }
}

/** Third step of the MCP import flow — only ever called after dashboard-summary already succeeded once for this dashboard (item 15/16 of the spec). Requires both dashboardId and a valid level. */
export async function POST(req: NextRequest) {
  const denied = await guardAuthorizedAccess()
  if (denied) return denied

  const body = (await req.json().catch(() => ({}))) as AdObjectsBody

  if (!body.dashboardId || typeof body.dashboardId !== 'string') {
    return NextResponse.json({ error: 'Selecione um dashboard UTMify antes de puxar dados.' }, { status: 400 })
  }

  const level = body.level as UtmifyMcpLevel | undefined
  if (!level || !VALID_LEVELS.includes(level)) {
    return NextResponse.json({ error: 'Selecione um nível válido: All, Account, Campaign, Adset ou Ad.' }, { status: 400 })
  }

  const platform = (body.platform ?? 'meta') as UtmifyMcpPlatform
  const tool = PLATFORM_TOOL[platform]
  if (!tool) {
    return NextResponse.json({ error: 'Plataforma inválida.' }, { status: 400 })
  }

  try {
    const raw = await callReadOnlyTool(tool, {
      dashboardId: body.dashboardId,
      level,
      dateRange: { start: body.period?.start ?? '', end: body.period?.end ?? '' },
    })
    const { rows, recognized } = normalizeUtmifyAdObjects(raw, { platform, level })
    return NextResponse.json({ ok: true, rows, recognized, raw })
  } catch (err) {
    return utmifyMcpErrorResponse(err, 'ad-objects')
  }
}
