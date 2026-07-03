import { getUtmifyMcpClient } from './utmify-mcp-client'
import {
  MissingUtmifyMcpUrlError,
  UtmifyMcpConnectionError,
  UtmifyMcpToolBlockedError,
  describeUtmifyMcpError,
} from './utmify-mcp-errors'
import type { ClassifiedMcpTool, McpTool, McpToolCallResult, UtmifyMcpImportRequest } from './utmify-mcp-types'
import type { PitbrainImport, PitbrainImportSummary } from '@/types/pitbrain'

// Tools known ahead of time to be safe, read-only UTMify MCP calls — always classified read_only
// and "reviewed" (a human, not just a heuristic, vouches for these) regardless of what the prefix/
// description-based classifier below would otherwise say.
export const UTMIFY_MCP_READ_ONLY_ALLOWLIST = ['get_dashboards', 'get_dashboard_summary', 'get_meta_ad_objects']

// Classification is prefix-based on the tool *name*, not a keyword scan over the whole
// name+description — the previous classifier scanned `\b(get|list|...)\b` over the full
// description text, which has two problems: (1) `\b` doesn't split on `_`, so `\bget\b` never
// matches inside `get_dashboards` (both sides of the "boundary" are word characters), silently
// failing to recognize the exact underscore-joined naming convention UTMify's MCP server uses;
// (2) scanning the description for bare words like "delete"/"set_"/"allowed" flags a tool as
// unsafe just because its *response* happens to contain a field with that name, not because the
// tool itself does anything mutable. `startsWith()` on the name avoids both.
const READ_ONLY_PREFIXES = ['get_', 'list_', 'fetch_', 'search_', 'read_', 'report_', 'summarize_', 'query_']
const BLOCKED_PREFIXES = [
  'create_', 'update_', 'delete_', 'remove_', 'set_', 'send_', 'post_', 'mutate_', 'write_', 'upsert_', 'patch_',
]

// Deliberately narrow: only trips on a strong, explicit statement about what the tool itself does
// ("cria/deleta/atualiza ... dados/registro/campanha"), not a bare keyword — this is what replaces
// the old whole-description keyword scan without reintroducing its false positives. A read_only-
// looking name that matches this becomes review_required, not blocked outright, since the name
// itself is still a strong (if contradicted) signal.
const MUTATION_DESCRIPTION_PATTERN =
  /\b(cria|criar|deleta|deletar|exclui|excluir|apaga|apagar|remove|remover|atualiza|atualizar|modifica|modificar|altera|alterar|envia|enviar|muta|mutar)\b[^.]{0,60}\b(dado|dados|registro|registros|campanha|pedido|configuraç\w*|dashboard|relatório)\b/i

export function classifyMcpTool(tool: McpTool): ClassifiedMcpTool {
  if (UTMIFY_MCP_READ_ONLY_ALLOWLIST.includes(tool.name)) {
    return { ...tool, safety: 'read_only', reviewed: true }
  }

  const name = tool.name.toLowerCase()

  if (BLOCKED_PREFIXES.some(prefix => name.startsWith(prefix))) {
    return { ...tool, safety: 'blocked', reviewed: true }
  }

  if (READ_ONLY_PREFIXES.some(prefix => name.startsWith(prefix))) {
    if (tool.description && MUTATION_DESCRIPTION_PATTERN.test(tool.description)) {
      return { ...tool, safety: 'review_required', reviewed: true }
    }
    // A get_/list_/etc. tool never seen before — still safe to auto-call, but the UI marks it
    // "não revisada" so a human eventually confirms it, since it wasn't hand-vetted like the
    // allowlist above.
    return { ...tool, safety: 'read_only', reviewed: false }
  }

  return { ...tool, safety: 'unknown', reviewed: false }
}

export interface UtmifyMcpStatus {
  ok: boolean
  /** Step 1: is UTMIFY_MCP_URL set at all. */
  configured: boolean
  /** Step 2: initialize + tools/list succeeded (transport/URL reachable). */
  connected: boolean
  /** Step 3: a minimal get_dashboards call succeeded — only set once `connected` is true. This is
   * the real end-to-end smoke test; `connected` alone just means the transport handshake worked. */
  dashboardsOk?: boolean
  tools?: string[]
  error?: string
}

/**
 * Staged status/connection check — used by GET /api/utmify-mcp/status and the "Testar conexão"
 * button. Never throws; failures are folded into the returned status shape. Three steps, each only
 * attempted if the previous one passed:
 *   1. UTMIFY_MCP_URL configured at all.
 *   2. initialize + tools/list reach the server (transport/URL/token accepted at the protocol level).
 *   3. get_dashboards — the one tool we know is safe and minimal — actually returns something. This
 *      is what catches a stale/regenerated UTMIFY_MCP_URL (UTMify's server answers tools/list fine
 *      but rejects the actual call with MCP_INTEGRATION_NOT_FOUND). Never calls
 *      get_dashboard_summary or get_meta_ad_objects here — those only make sense once a dashboard id
 *      is known, which this status check has no way to get.
 */
export async function getMcpStatus(): Promise<UtmifyMcpStatus> {
  if (!process.env.UTMIFY_MCP_URL) {
    return { ok: true, configured: false, connected: false }
  }

  let toolNames: string[]
  try {
    const client = getUtmifyMcpClient()
    const tools = await client.listTools()
    toolNames = tools.map(t => t.name)
  } catch (err) {
    return { ok: false, configured: true, connected: false, error: describeUtmifyMcpError(err) }
  }

  try {
    const client = getUtmifyMcpClient()
    await client.callTool('get_dashboards', {})
    return { ok: true, configured: true, connected: true, dashboardsOk: true, tools: toolNames }
  } catch (err) {
    return {
      ok: false,
      configured: true,
      connected: true,
      dashboardsOk: false,
      tools: toolNames,
      error: describeUtmifyMcpError(err),
    }
  }
}

/** Every tool the remote server reports, each annotated with PitBrain's own read-only classification — never trust the remote server's own claims about itself. */
export async function listClassifiedTools(): Promise<ClassifiedMcpTool[]> {
  const client = getUtmifyMcpClient()
  const tools = await client.listTools()
  return tools.map(classifyMcpTool)
}

/** Calls a tool only if it classifies as read_only — throws UtmifyMcpToolBlockedError for blocked, review_required, AND unknown tools alike (all three are non-callable in this MVP). Re-fetches and re-classifies the tool list on every call rather than trusting a cached/client-supplied classification, since the tool list is server-controlled and could change. */
export async function callReadOnlyTool(name: string, args?: Record<string, unknown>): Promise<McpToolCallResult> {
  const client = getUtmifyMcpClient()
  const tools = await client.listTools()
  const tool = tools.find(t => t.name === name)
  const classified = tool ? classifyMcpTool(tool) : null
  if (!classified || classified.safety !== 'read_only') {
    throw new UtmifyMcpToolBlockedError(name, classified?.safety)
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

/**
 * Placeholder — specific to `get_dashboard_summary`'s result shape, which isn't confirmed yet
 * (UTMIFY_MCP_URL hasn't been testable against the real server in this session). Once it is, map
 * its fields into a PitbrainImportSummary the same way lib/parsers/utmify-parser.ts does for CSV
 * rows, reusing lib/utmify-mcp/utmify-mcp-normalizers.ts's re-exported BR money/percent/count
 * parsers — do not hand-roll a second parser here. Returns null until then.
 */
export function normalizeUtmifyMcpSummaryToImport(_result: McpToolCallResult): Partial<PitbrainImport> | null {
  return null
}

export { MissingUtmifyMcpUrlError, UtmifyMcpConnectionError, UtmifyMcpToolBlockedError }
