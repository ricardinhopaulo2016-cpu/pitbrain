import { NextRequest, NextResponse } from 'next/server'
import { guardAuthorizedAccess } from '@/lib/auth/get-current-user'
import { callReadOnlyTool } from '@/lib/utmify-mcp/utmify-mcp-service'
import { utmifyMcpErrorResponse } from '@/lib/utmify-mcp/utmify-mcp-errors'

/** Calls a single MCP tool — only permitted for tools the read-only classifier approves (see callReadOnlyTool). Every other tool, known or not, is rejected with 403 before any call reaches the remote server. */
export async function POST(req: NextRequest) {
  const denied = await guardAuthorizedAccess()
  if (denied) return denied

  const body = (await req.json().catch(() => ({}))) as { tool?: string; arguments?: Record<string, unknown> }
  if (!body.tool || typeof body.tool !== 'string') {
    return NextResponse.json({ error: 'Campo "tool" obrigatório.' }, { status: 400 })
  }

  try {
    const result = await callReadOnlyTool(body.tool, body.arguments)
    return NextResponse.json({ result })
  } catch (err) {
    return utmifyMcpErrorResponse(err, 'call')
  }
}
