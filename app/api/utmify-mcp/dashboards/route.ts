import { NextResponse } from 'next/server'
import { guardAuthorizedAccess } from '@/lib/auth/get-current-user'
import { callReadOnlyTool } from '@/lib/utmify-mcp/utmify-mcp-service'
import { utmifyMcpErrorResponse } from '@/lib/utmify-mcp/utmify-mcp-errors'
import { normalizeUtmifyDashboards } from '@/lib/utmify-mcp/utmify-mcp-normalizers'

/** First step of the MCP import flow — always called before dashboard-summary/ad-objects, which both require a dashboardId this returns. */
export async function GET() {
  const denied = await guardAuthorizedAccess()
  if (denied) return denied

  try {
    const raw = await callReadOnlyTool('get_dashboards', {})
    const { dashboards, recognized } = normalizeUtmifyDashboards(raw)
    return NextResponse.json({ ok: true, dashboards, recognized, raw })
  } catch (err) {
    return utmifyMcpErrorResponse(err, 'dashboards')
  }
}
