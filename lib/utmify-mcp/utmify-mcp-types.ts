// Minimal Model Context Protocol (MCP) types — just enough of the JSON-RPC 2.0 envelope and the
// `initialize` / `tools/list` / `tools/call` methods to talk to a remote MCP server over HTTP.
// Not a full MCP SDK — PitBrain only ever acts as a client here, and only for read-only tools.

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: Record<string, unknown>
}

export interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
}

export interface JsonRpcErrorObject {
  code: number
  message: string
  data?: unknown
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0'
  id: number | string
  result?: T
  error?: JsonRpcErrorObject
}

export interface McpServerInfo {
  name: string
  version: string
}

export interface McpInitializeResult {
  protocolVersion: string
  capabilities: Record<string, unknown>
  serverInfo?: McpServerInfo
}

/** A tool as reported by the remote MCP server's `tools/list`. */
export interface McpTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface McpToolsListResult {
  tools: McpTool[]
  nextCursor?: string
}

export interface McpContentItem {
  type: string
  text?: string
  [key: string]: unknown
}

export interface McpToolCallResult {
  content: McpContentItem[]
  isError?: boolean
  structuredContent?: unknown
}

/** Result of PitBrain's own read-only classification (lib/utmify-mcp/utmify-mcp-service.ts's
 * classifyMcpTool) — never trust the remote server's own description alone for this.
 * - read_only: safe to call automatically (name prefix matches a known read verb, or explicitly
 *   allowlisted).
 * - blocked: name prefix matches a known write/mutate verb — never callable.
 * - review_required: name looks read-only, but the description explicitly says the tool
 *   creates/deletes/updates/sends/mutates data — not auto-callable until a human confirms it.
 * - unknown: name doesn't match any known prefix — not auto-callable, deny-by-default. */
export type ToolSafety = 'read_only' | 'blocked' | 'review_required' | 'unknown'

/** A tool annotated with PitBrain's own read-only classification. */
export interface ClassifiedMcpTool extends McpTool {
  safety: ToolSafety
  /** true when the classification is either an explicit allowlist hit or matched a known blocked
   * prefix (high confidence) — false when it's a generic "name looks like a read verb, never seen
   * before" inference (still auto-callable if safety is read_only, but the UI marks it
   * "não revisada" so a human can confirm it later). */
  reviewed: boolean
}

// ── Future import prep (not wired into the real import pipeline yet — see
// createImportFromUtmifyMcpResult in utmify-mcp-service.ts) ──────────────────────

export interface UtmifyMcpImportRequest {
  dateRange?: { start: string; end: string }
  breakdownLevel?: 'campaign' | 'adset' | 'ad' | 'placement' | 'daily'
  dimension?: 'utm_campaign' | 'utm_medium' | 'utm_content' | 'utm_term'
}
