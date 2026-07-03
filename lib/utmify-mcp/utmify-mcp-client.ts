import { MissingUtmifyMcpUrlError, UtmifyMcpConnectionError } from './utmify-mcp-errors'
import type {
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcResponse,
  McpInitializeResult,
  McpTool,
  McpToolsListResult,
  McpToolCallResult,
} from './utmify-mcp-types'

const REQUEST_TIMEOUT_MS = 20_000
const PROTOCOL_VERSION = '2025-03-26'

/** Redacts the `token` query param so a URL is safe to log — never log the raw UTMIFY_MCP_URL. */
function redactUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    if (url.searchParams.has('token')) url.searchParams.set('token', '***redacted***')
    return url.toString()
  } catch {
    return '***invalid-url***'
  }
}

/**
 * Server-only client for a remote UTMify MCP (Model Context Protocol) server, reached over its
 * Streamable HTTP transport (JSON-RPC 2.0 POST requests; responses may come back as a single JSON
 * body or as a `text/event-stream`, both handled below). The URL (with its token embedded as a
 * query param) is read from process.env.UTMIFY_MCP_URL and never accepted from a caller — do not
 * add a constructor path that takes a URL from request input, and never log the raw URL.
 */
export class UtmifyMcpClient {
  private readonly url: string
  private sessionId: string | null = null
  private nextId = 1
  private initialized = false

  constructor(url?: string) {
    if (typeof window !== 'undefined') {
      throw new UtmifyMcpConnectionError('UtmifyMcpClient só pode ser usado server-side.')
    }
    const resolved = url ?? process.env.UTMIFY_MCP_URL
    if (!resolved) throw new MissingUtmifyMcpUrlError()
    this.url = resolved
  }

  private async rpcCall<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const id = this.nextId++
    const body: JsonRpcRequest = { jsonrpc: '2.0', id, method, params }
    const json = await this.send(body)
    if (!('id' in json)) {
      throw new UtmifyMcpConnectionError(`Resposta do MCP UTMify sem id para o método ${method}.`)
    }
    if (json.error) {
      throw new UtmifyMcpConnectionError(`MCP UTMify (${method}): ${json.error.message}`, 502)
    }
    return json.result as T
  }

  /** Fire-and-forget JSON-RPC notification (no response expected) — used for `notifications/initialized`. */
  private async rpcNotify(method: string, params?: Record<string, unknown>): Promise<void> {
    const body: JsonRpcNotification = { jsonrpc: '2.0', method, params }
    await this.send(body)
  }

  private async send(body: JsonRpcRequest | JsonRpcNotification): Promise<JsonRpcResponse> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[pitbrain:utmify-mcp] POST', redactUrl(this.url), body.method)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      }
      if (this.sessionId) headers['Mcp-Session-Id'] = this.sessionId

      const res = await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      const sessionHeader = res.headers.get('Mcp-Session-Id')
      if (sessionHeader) this.sessionId = sessionHeader

      if (!res.ok) {
        throw new UtmifyMcpConnectionError(`MCP UTMify respondeu com status ${res.status}.`, res.status)
      }

      // "method" without "id" is a notification — no response body to parse.
      if (!('id' in body)) return { jsonrpc: '2.0', id: 0 }

      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('text/event-stream')) {
        return this.parseSseResponse(await res.text(), body.id)
      }
      return (await res.json()) as JsonRpcResponse
    } catch (err) {
      if (err instanceof UtmifyMcpConnectionError) throw err
      if (err instanceof Error && err.name === 'AbortError') {
        throw new UtmifyMcpConnectionError('Timeout ao chamar o MCP UTMify.', 408)
      }
      throw new UtmifyMcpConnectionError(err instanceof Error ? err.message : String(err))
    } finally {
      clearTimeout(timer)
    }
  }

  /** Parses a Streamable-HTTP SSE body — takes the `data:` frame whose `id` matches our request, falling back to the last parsable frame if no match is found. */
  private parseSseResponse(text: string, requestId: number | string): JsonRpcResponse {
    const frames: JsonRpcResponse[] = []
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      try {
        frames.push(JSON.parse(trimmed.slice(5).trim()) as JsonRpcResponse)
      } catch {
        // ignore malformed frame — best-effort parsing
      }
    }
    const matched = frames.find(f => f.id === requestId)
    if (matched) return matched
    if (frames.length > 0) return frames[frames.length - 1]
    throw new UtmifyMcpConnectionError('Resposta SSE do MCP UTMify vazia ou ilegível.')
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return
    await this.rpcCall<McpInitializeResult>('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'pitbrain', version: '1.0' },
    })
    await this.rpcNotify('notifications/initialized')
    this.initialized = true
  }

  async listTools(): Promise<McpTool[]> {
    await this.ensureInitialized()
    const result = await this.rpcCall<McpToolsListResult>('tools/list')
    return result.tools ?? []
  }

  async callTool(name: string, args?: Record<string, unknown>): Promise<McpToolCallResult> {
    await this.ensureInitialized()
    return this.rpcCall<McpToolCallResult>('tools/call', { name, arguments: args ?? {} })
  }
}

let sharedClient: UtmifyMcpClient | null = null

/** Lazily-created singleton for the default configuration (process.env.UTMIFY_MCP_URL). Throws MissingUtmifyMcpUrlError if unset — callers should catch that to render a "não configurado" state instead of a hard error. */
export function getUtmifyMcpClient(): UtmifyMcpClient {
  if (!sharedClient) sharedClient = new UtmifyMcpClient()
  return sharedClient
}
