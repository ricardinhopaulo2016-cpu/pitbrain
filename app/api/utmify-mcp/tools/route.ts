import { NextResponse } from 'next/server'
import { guardAuthorizedAccess } from '@/lib/auth/get-current-user'
import { listClassifiedTools } from '@/lib/utmify-mcp/utmify-mcp-service'
import { utmifyMcpErrorResponse } from '@/lib/utmify-mcp/utmify-mcp-errors'

/** Lists every tool the remote MCP server reports, each tagged read-only/bloqueada — never exposes the token (the client never sees UTMIFY_MCP_URL at all, only tool names/descriptions/schemas). */
export async function GET() {
  const denied = await guardAuthorizedAccess()
  if (denied) return denied

  try {
    const tools = await listClassifiedTools()
    return NextResponse.json({ tools })
  } catch (err) {
    return utmifyMcpErrorResponse(err, 'tools')
  }
}
