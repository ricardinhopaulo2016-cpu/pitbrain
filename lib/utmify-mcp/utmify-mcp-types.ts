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

/** A tool annotated with PitBrain's own read-only classification (lib/utmify-mcp/utmify-mcp-service.ts) — never trust the remote server's own description alone for this. */
export interface ClassifiedMcpTool extends McpTool {
  readOnly: boolean
}

// ── Future import prep (not wired into the real import pipeline yet — see
// createImportFromUtmifyMcpResult in utmify-mcp-service.ts) ──────────────────────

export interface UtmifyMcpImportRequest {
  dateRange?: { start: string; end: string }
  breakdownLevel?: 'campaign' | 'adset' | 'ad' | 'placement' | 'daily'
  dimension?: 'utm_campaign' | 'utm_medium' | 'utm_content' | 'utm_term'
}
