import { getUtmifyMcpClient } from './utmify-mcp-client'
import { MissingUtmifyMcpUrlError, UtmifyMcpConnectionError, UtmifyMcpToolBlockedError } from './utmify-mcp-errors'
import type { ClassifiedMcpTool, McpTool, McpToolCallResult, UtmifyMcpImportRequest } from './utmify-mcp-types'
import type { PitbrainImport, PitbrainImportSummary } from '@/types/pitbrain'

// Any of these anywhere in a tool's name/description blocks it outright, regardless of what else
// matches — mirrors the read-only stance of lib/meta/meta-service.ts's write-action stubs, but
// applied dynamically since (unlike Meta's fixed internal API surface) the UTMify MCP tool list is
// whatever the remote server reports and isn't known ahead of time.
const WRITE_KEYWORD_PATTERN = /\b(create|update|delete|remove|mutate|send|post|write)\b/i

// A tool must look read-only (one of these) AND not match the block pattern above to be classified
// read-only — deny-by-default for anything that doesn't clearly announce itself as a read/list/
// fetch-style operation.
const READ_ONLY_KEYWORD_PATTERN = /\b(get|list|search|fetch|report|metrics|orders|sales|campaigns|utms)\b/i

function classifyTool(tool: McpTool): ClassifiedMcpTool {
  const haystack = `${tool.name} ${tool.description ?? ''}`
  const blocked = WRITE_KEYWORD_PATTERN.test(haystack)
  const looksReadOnly = READ_ONLY_KEYWORD_PATTERN.test(haystack)
  return { ...tool, readOnly: looksReadOnly && !blocked }
}

export interface UtmifyMcpStatus {
  ok: boolean
  configured: boolean
  connected: boolean
  tools?: string[]
  error?: string
}

/** Lightweight status/connection check — used by GET /api/utmify-mcp/status and the "Testar conexão" button. Never throws; failures are folded into the returned status shape. */
export async function getMcpStatus(): Promise<UtmifyMcpStatus> {
  if (!process.env.UTMIFY_MCP_URL) {
    return { ok: true, configured: false, connected: false }
  }

  try {
    const client = getUtmifyMcpClient()
    const tools = await client.listTools()
    return { ok: true, configured: true, connected: true, tools: tools.map(t => t.name) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao conectar com o MCP UTMify.'
    return { ok: false, configured: true, connected: false, error: message }
  }
}

/** Every tool the remote server reports, each annotated with PitBrain's own read-only classification — never trust the remote server's own claims about itself. */
export async function listClassifiedTools(): Promise<ClassifiedMcpTool[]> {
  const client = getUtmifyMcpClient()
  const tools = await client.listTools()
  return tools.map(classifyTool)
}

/** Calls a tool only if it passes the read-only classifier — throws UtmifyMcpToolBlockedError otherwise. Re-fetches and re-classifies the tool list on every call rather than trusting a cached/client-supplied classification, since the tool list is server-controlled and could change. */
export async function callReadOnlyTool(name: string, args?: Record<string, unknown>): Promise<McpToolCallResult> {
  const client = getUtmifyMcpClient()
  const tools = await client.listTools()
  const tool = tools.find(t => t.name === name)
  if (!tool || !classifyTool(tool).readOnly) {
    throw new UtmifyMcpToolBlockedError(name)
  }
  return client.callTool(name, args)
}

const EMPTY_SUMMARY: PitbrainImportSummary = {
  spend: 0,
  revenue: 0,
  profit: 0,
  roas: null,
  roi: null,
  sales: 0,
  cpa: null,
  cpc: null,
  ctr: null,
  cpm: null,
  clicks: 0,
  impressions: 0,
  pageViews: 0,
  ic: 0,
}

/**
 * Placeholder — prepares (does not yet persist) a PitbrainImport-shaped object from a raw MCP tool
 * call result, so a future "import from UTMify MCP" flow can plug into the exact same storage/UI
 * pipeline as CSV/XLSX uploads instead of a parallel one. Row-level parsing (money/percent/count,
 * Page Views/IC reconciliation) is intentionally NOT implemented here yet — the real UTMify MCP
 * response shape isn't known until UTMIFY_MCP_URL is configured and testable; this only establishes
 * the target shape and field names, using lib/utmify-mcp/utmify-mcp-normalizers.ts's re-exports
 * once a concrete row parser is written.
 */
export function createImportFromUtmifyMcpResult(
  result: McpToolCallResult,
  request: UtmifyMcpImportRequest,
  meta: { name: string; originalFileName: string }
): Omit<PitbrainImport, 'id' | 'fileHash' | 'createdAt' | 'updatedAt'> {
  return {
    name: meta.name,
    originalFileName: meta.originalFileName,
    source: 'utmify',
    sourceType: 'utmify_mcp',
    breakdownLevel: request.breakdownLevel === 'daily' ? undefined : request.breakdownLevel,
    dimensionField: request.dimension,
    dateRange: request.dateRange ?? null,
    rows: result.structuredContent ? [result.structuredContent] : [],
    summary: EMPTY_SUMMARY,
    rowCount: 0,
    ignoredFooterRowsCount: 0,
  }
}

export { MissingUtmifyMcpUrlError, UtmifyMcpConnectionError, UtmifyMcpToolBlockedError }
