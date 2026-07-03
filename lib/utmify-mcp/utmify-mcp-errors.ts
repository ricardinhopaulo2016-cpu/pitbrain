import { NextResponse } from 'next/server'
import type { ToolSafety } from './utmify-mcp-types'

export class MissingUtmifyMcpUrlError extends Error {
  constructor(message = 'Configure UTMIFY_MCP_URL nas variáveis de ambiente.') {
    super(message)
    this.name = 'MissingUtmifyMcpUrlError'
  }
}

/** Any failure talking to the remote MCP server — network error, non-2xx response, malformed
 * JSON-RPC envelope, or a JSON-RPC-level error object. */
export class UtmifyMcpConnectionError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'UtmifyMcpConnectionError'
    this.status = status
  }
}

/** Thrown when a caller tries to invoke a tool that didn't pass the read-only classifier — covers
 * blocked, review_required, and unknown alike (only read_only is auto-callable in this MVP). */
export class UtmifyMcpToolBlockedError extends Error {
  readonly safety?: ToolSafety

  constructor(toolName: string, safety?: ToolSafety) {
    super(`Ferramenta MCP bloqueada por segurança: ${toolName}${safety ? ` (status: ${safety})` : ''}.`)
    this.name = 'UtmifyMcpToolBlockedError'
    this.safety = safety
  }
}

export type UtmifyMcpErrorKind = 'missing_url' | 'connection_error' | 'tool_blocked' | 'internal'

/** Shared error → HTTP response mapping for every app/api/utmify-mcp/* route — mirrors metaErrorResponse() in lib/meta/meta-errors.ts. */
export function utmifyMcpErrorResponse(err: unknown, routeName: string): NextResponse {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[pitbrain:utmify-mcp:${routeName}]`, err instanceof Error ? err.message : err)
  }

  if (err instanceof MissingUtmifyMcpUrlError) {
    return NextResponse.json({ error: err.message, kind: 'missing_url' satisfies UtmifyMcpErrorKind }, { status: 400 })
  }
  if (err instanceof UtmifyMcpToolBlockedError) {
    return NextResponse.json({ error: err.message, kind: 'tool_blocked' satisfies UtmifyMcpErrorKind }, { status: 403 })
  }
  if (err instanceof UtmifyMcpConnectionError) {
    return NextResponse.json(
      { error: err.message, kind: 'connection_error' satisfies UtmifyMcpErrorKind },
      { status: err.status ?? 502 }
    )
  }

  const detail = err instanceof Error ? err.message : String(err)
  return NextResponse.json(
    { error: 'Erro interno ao consultar o MCP da UTMify.', kind: 'internal' satisfies UtmifyMcpErrorKind, detail },
    { status: 500 }
  )
}
