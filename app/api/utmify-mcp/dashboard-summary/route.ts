import { NextRequest, NextResponse } from 'next/server'
import { guardAuthorizedAccess } from '@/lib/auth/get-current-user'
import { callReadOnlyTool } from '@/lib/utmify-mcp/utmify-mcp-service'
import { utmifyMcpErrorResponse } from '@/lib/utmify-mcp/utmify-mcp-errors'
import { normalizeUtmifyDashboardSummary } from '@/lib/utmify-mcp/utmify-mcp-normalizers'

interface DashboardSummaryBody {
  dashboardId?: string
  period?: { label?: string; start?: string; end?: string }
}

/** Second step of the MCP import flow — never called without a dashboardId (item 15 of the spec: get_dashboard_summary always needs one). */
export async function POST(req: NextRequest) {
  const denied = await guardAuthorizedAccess()
  if (denied) return denied

  const body = (await req.json().catch(() => ({}))) as DashboardSummaryBody
  if (!body.dashboardId || typeof body.dashboardId !== 'string') {
    return NextResponse.json({ error: 'Selecione um dashboard UTMify antes de puxar dados.' }, { status: 400 })
  }

  const period = {
    label: body.period?.label ?? '',
    start: body.period?.start ?? '',
    end: body.period?.end ?? '',
  }

  try {
    const raw = await callReadOnlyTool('get_dashboard_summary', {
      dashboardId: body.dashboardId,
      dateRange: { start: period.start, end: period.end },
    })
    const { summary, row, recognized } = normalizeUtmifyDashboardSummary(raw, period)
    return NextResponse.json({ ok: true, summary, row, recognized, raw })
  } catch (err) {
    return utmifyMcpErrorResponse(err, 'dashboard-summary')
  }
}
