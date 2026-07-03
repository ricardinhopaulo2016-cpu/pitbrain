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
 * Server-only client for a remote UTMify MCP (Model Context Protocol) server. `this.url` is always
 * `process.env.UTMIFY_MCP_URL` (or the exact override passed to the constructor) used byte-for-byte
 * in every request — it is NEVER parsed apart and rebuilt from pieces (no hardcoded host/path/query
 * template anywhere in this file). Whatever UTMify's "Copiar URL" button gives you — `/mcp`, `/sse`,
 * a different host, a differently-named token param — is respected exactly. Never accept a token or
 * URL from a caller/request body, and never log the raw URL (always through redactUrl()).
 *
 * Two transports are supported, chosen by the URL's own path (not guessed from response headers),
 * since that's how UTMify's server itself tells you which one to use:
 * - Default — MCP's Streamable HTTP transport: a single POST endpoint, JSON-RPC request in the
 *   body, response comes back either as a plain JSON body or as one `text/event-stream` frame.
 * - `/sse`-suffixed URLs — the older HTTP+SSE transport: GET the URL to open an SSE stream, read
 *   the server's first `endpoint` event (where to POST), POST the JSON-RPC message there, then keep
 *   reading the same SSE stream until the response with a matching `id` shows up.
 */
export class UtmifyMcpClient {
  private readonly url: string
  private readonly legacySse: boolean
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
    try {
      this.legacySse = new URL(resolved).pathname.replace(/\/+$/, '').toLowerCase().endsWith('/sse')
    } catch {
      this.legacySse = false
    }
  }

  private async rpcCall<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const id = this.nextId++
    const body: JsonRpcRequest = { jsonrpc: '2.0', id, method, params }
    const json = await this.send(body)
    if (!('id' in json)) {
      throw new UtmifyMcpConnectionError(`Resposta do MCP UTMify sem id para o método ${method}.`)
    }
    if (json.error) {
      throw new UtmifyMcpConnectionError(`MCP UTMify (${method}): ${json.error.message}`, 502, json.error.code, json.error.data)
    }
    return json.result as T
  }

  /** Fire-and-forget JSON-RPC notification (no response expected) — used for `notifications/initialized`. */
  private async rpcNotify(method: string, params?: Record<string, unknown>): Promise<void> {
    const body: JsonRpcNotification = { jsonrpc: '2.0', method, params }
    await this.send(body)
  }

  private async send(body: JsonRpcRequest | JsonRpcNotification): Promise<JsonRpcResponse> {
    return this.legacySse ? this.sendLegacySse(body) : this.sendStreamableHttp(body)
  }

  private async sendStreamableHttp(body: JsonRpcRequest | JsonRpcNotification): Promise<JsonRpcResponse> {
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

  /**
   * Legacy MCP "HTTP with SSE" transport, used when `this.url`'s own path ends in `/sse`: GET the
   * URL to open an SSE stream, read the server's first `endpoint` event (the URL to POST JSON-RPC
   * messages to — usually the same origin as `this.url` plus a session id, so it's resolved against
   * `this.url` rather than assumed), POST the message there, then keep reading the same open stream
   * for a `message` event whose JSON-RPC `id` matches ours. Everything happens inside this one
   * method call — no state is kept between separate calls, so each `rpcCall`/`rpcNotify` opens and
   * tears down its own SSE connection. Less efficient than Streamable HTTP, but correct, and only
   * used when the URL itself says to.
   */
  private async sendLegacySse(body: JsonRpcRequest | JsonRpcNotification): Promise<JsonRpcResponse> {
    if (process.env.NODE_ENV === 'development') {
      console.log('[pitbrain:utmify-mcp] SSE', redactUrl(this.url), body.method)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const getRes = await fetch(this.url, {
        method: 'GET',
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal,
      })
      if (!getRes.ok || !getRes.body) {
        throw new UtmifyMcpConnectionError(`MCP UTMify (SSE) respondeu com status ${getRes.status} ao abrir o stream.`, getRes.status)
      }

      const reader = getRes.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      async function readNextEvent(): Promise<{ event: string; data: string } | null> {
        while (true) {
          const frameEnd = buffer.indexOf('\n\n')
          if (frameEnd !== -1) {
            const frame = buffer.slice(0, frameEnd)
            buffer = buffer.slice(frameEnd + 2)
            let event = 'message'
            const dataLines: string[] = []
            for (const line of frame.split('\n')) {
              if (line.startsWith('event:')) event = line.slice(6).trim()
              else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
            }
            if (dataLines.length > 0) return { event, data: dataLines.join('\n') }
            continue // frame with no data (e.g. a bare comment/ping) — keep reading
          }
          const { value, done } = await reader.read()
          if (done) return null
          buffer += decoder.decode(value, { stream: true })
        }
      }

      try {
        const endpointEvent = await readNextEvent()
        if (!endpointEvent) {
          throw new UtmifyMcpConnectionError('MCP UTMify (SSE) fechou o stream antes de enviar o endpoint de sessão.')
        }
        const endpointUrl = new URL(endpointEvent.data, this.url).toString()

        const postRes = await fetch(endpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        if (!postRes.ok) {
          throw new UtmifyMcpConnectionError(`MCP UTMify (SSE) respondeu com status ${postRes.status} ao enviar a mensagem.`, postRes.status)
        }

        // A notification (no "id") has no response to wait for.
        if (!('id' in body)) return { jsonrpc: '2.0', id: 0 }

        while (true) {
          const evt = await readNextEvent()
          if (!evt) throw new UtmifyMcpConnectionError('MCP UTMify (SSE) fechou o stream antes de responder.')
          try {
            const parsed = JSON.parse(evt.data) as JsonRpcResponse
            if (parsed.id === body.id) return parsed
          } catch {
            // not a JSON-RPC frame (e.g. a keep-alive comment) — keep reading
          }
        }
      } finally {
        reader.cancel().catch(() => {})
      }
    } catch (err) {
      if (err instanceof UtmifyMcpConnectionError) throw err
      if (err instanceof Error && err.name === 'AbortError') {
        throw new UtmifyMcpConnectionError('Timeout ao chamar o MCP UTMify (SSE).', 408)
      }
      throw new UtmifyMcpConnectionError(err instanceof Error ? err.message : String(err))
    } finally {
      clearTimeout(timer)
    }
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
