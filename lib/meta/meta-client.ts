import { MetaAPIError, MissingMetaTokenError } from './meta-errors'
import type { MetaListResponse } from './meta-types'

const DEFAULT_API_VERSION = 'v21.0'
const REQUEST_TIMEOUT_MS = 20_000
const MIN_INTERVAL_MS = 250 // client-side spacing between requests to avoid bursts against Meta's rate limits

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface MetaClientOptions {
  accessToken?: string
  apiVersion?: string
}

/**
 * Server-only client for the Meta Graph Marketing API.
 * The access token is read from process.env and never accepted from a caller —
 * do not add a constructor path that takes a token from request input.
 */
export class MetaClient {
  private readonly accessToken: string
  private readonly apiVersion: string
  private readonly baseUrl: string
  private lastRequestAt = 0
  // Serializes throttle() calls so concurrent requests (e.g. Promise.all fan-out during sync)
  // are spaced by MIN_INTERVAL_MS instead of all reading a stale lastRequestAt at once.
  private throttleQueue: Promise<void> = Promise.resolve()
  // Best-effort snapshot of Meta's own rate-limit usage headers from the most recent response —
  // debug-only, never read to decide whether to make a request.
  private lastUsage: Record<string, unknown> | null = null
  // Best-effort diagnostics from the most recent paginate() call (e.g. "repeated next URL
  // detected", "maxPages hit") — debug-only, cleared on read.
  private lastWarnings: string[] = []

  constructor(options: MetaClientOptions = {}) {
    if (typeof window !== 'undefined') {
      throw new MetaAPIError('MetaClient só pode ser usado server-side.')
    }

    const token = options.accessToken ?? process.env.META_ACCESS_TOKEN
    if (!token) throw new MissingMetaTokenError()

    this.accessToken = token
    this.apiVersion = options.apiVersion ?? process.env.META_API_VERSION ?? DEFAULT_API_VERSION
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`
  }

  private throttle(): Promise<void> {
    const turn = this.throttleQueue.then(async () => {
      const elapsed = Date.now() - this.lastRequestAt
      if (elapsed < MIN_INTERVAL_MS) await sleep(MIN_INTERVAL_MS - elapsed)
      this.lastRequestAt = Date.now()
    })
    this.throttleQueue = turn
    return turn
  }

  /**
   * Best-effort capture of Meta's rate-limit usage headers (x-app-usage, x-business-use-case-usage,
   * x-ad-account-usage) — purely for debug via getLastUsage(), never used to gate requests. A
   * missing header or unparseable JSON is silently ignored.
   */
  private captureUsageHeaders(res: Response): void {
    const usage: Record<string, unknown> = {}
    for (const header of ['x-app-usage', 'x-business-use-case-usage', 'x-ad-account-usage']) {
      const raw = res.headers.get(header)
      if (!raw) continue
      try {
        usage[header] = JSON.parse(raw)
      } catch {
        usage[header] = raw
      }
    }
    if (Object.keys(usage).length === 0) return
    this.lastUsage = usage
    if (process.env.NODE_ENV === 'development') {
      console.log('[pitbrain:meta-client] usage', usage)
    }
  }

  /** Debug-only snapshot of the most recent Meta rate-limit usage headers seen, if any. */
  getLastUsage(): Record<string, unknown> | null {
    return this.lastUsage
  }

  /** Debug-only pagination warnings from the most recent paginate() call — cleared on read. */
  getLastWarnings(): string[] {
    const warnings = this.lastWarnings
    this.lastWarnings = []
    return warnings
  }

  private async requestJson<T>(
    url: URL,
    externalSignal?: AbortSignal,
    onRequest?: (path?: string) => void,
    endpointLabel?: string
  ): Promise<T> {
    await this.throttle()

    if (externalSignal?.aborted) {
      throw new MetaAPIError('Sync abortado antes da chamada à Meta API.', 499)
    }

    // Fires once per real attempt (including every page of a paginate() call) — lets the sync
    // route's stall watchdog know a request is actually in flight, distinct from the sync being
    // stuck waiting on something that never touches the Meta API at all. `endpointLabel` is the
    // original relative path (stable across pagination, unlike the ever-changing `paging.next`
    // URL) — used for rate-limit/debug diagnostics ("which endpoint were we calling").
    onRequest?.(endpointLabel)

    if (process.env.NODE_ENV === 'development') {
      const redacted = new URL(url.toString())
      if (redacted.searchParams.has('access_token')) redacted.searchParams.set('access_token', '***')
      console.log('[pitbrain:meta-client] GET', redacted.pathname + redacted.search)
    }

    // Two independent abort sources: our own per-request timeout, and an optional
    // external signal (global sync timeout / user cancel) — either one aborts the fetch.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    const onExternalAbort = () => controller.abort()
    externalSignal?.addEventListener('abort', onExternalAbort)

    try {
      const res = await fetch(url.toString(), { signal: controller.signal })
      this.captureUsageHeaders(res)
      const json = await res.json().catch(() => null)

      if (!res.ok || json?.error) {
        const apiErr = json?.error
        throw new MetaAPIError(
          apiErr?.message ?? `Meta API respondeu com status ${res.status}.`,
          res.status,
          apiErr?.code,
          apiErr?.fbtrace_id
        )
      }

      return json as T
    } catch (err) {
      if (err instanceof MetaAPIError) throw err
      if (err instanceof Error && err.name === 'AbortError') {
        if (externalSignal?.aborted) {
          throw new MetaAPIError(`Sync abortado durante chamada à Meta API (${url.pathname}).`, 499)
        }
        throw new MetaAPIError(`Timeout ao chamar a Meta API (${url.pathname}).`, 408)
      }
      throw new MetaAPIError(err instanceof Error ? err.message : String(err))
    } finally {
      clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onExternalAbort)
    }
  }

  /** GET a relative Marketing API path, e.g. `/act_123/campaigns`. */
  async get<T = unknown>(
    path: string,
    params: Record<string, string | number | undefined> = {},
    signal?: AbortSignal,
    onRequest?: (path?: string) => void
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
    }
    url.searchParams.set('access_token', this.accessToken)
    return this.requestJson<T>(url, signal, onRequest, path)
  }

  /**
   * GET all pages for a list endpoint, following `paging.next` until exhausted, maxPages is hit,
   * the same `paging.next` URL repeats (a real Graph API quirk where a "last" page still hands back
   * a next link), or two consecutive pages come back empty while still claiming a next link (seen
   * on some accounts near the end of a result set) — all three stop the loop and record a debug
   * warning instead of looping/burning through the full maxPages budget silently.
   */
  async paginate<T = unknown>(
    path: string,
    params: Record<string, string | number | undefined> = {},
    maxPages = 10,
    signal?: AbortSignal,
    onRequest?: (path?: string) => void
  ): Promise<T[]> {
    const dev = process.env.NODE_ENV === 'development'
    const visitedNextUrls = new Set<string>()
    const results: T[] = []
    let consecutiveEmptyPages = 0

    let page = await this.get<MetaListResponse<T>>(path, params, signal, onRequest)
    results.push(...(page.data ?? []))
    consecutiveEmptyPages = (page.data?.length ?? 0) === 0 ? 1 : 0
    let pageCount = 1
    if (dev) {
      console.log(
        `[pitbrain:meta-client] paginate ${path} page=${pageCount} items=${page.data?.length ?? 0} total=${results.length} hasNext=${Boolean(page.paging?.next)} nextUrlRepeated=false`
      )
    }

    while (page.paging?.next && pageCount < maxPages) {
      const nextUrl = page.paging.next
      if (visitedNextUrls.has(nextUrl)) {
        this.lastWarnings.push('Paginação repetida detectada.')
        if (dev) console.log(`[pitbrain:meta-client] paginate ${path} — repeated next URL, stopping`)
        break
      }
      visitedNextUrls.add(nextUrl)

      page = await this.requestJson<MetaListResponse<T>>(new URL(nextUrl), signal, onRequest, path)
      results.push(...(page.data ?? []))
      pageCount++
      const itemsThisPage = page.data?.length ?? 0
      consecutiveEmptyPages = itemsThisPage === 0 ? consecutiveEmptyPages + 1 : 0
      if (dev) {
        console.log(
          `[pitbrain:meta-client] paginate ${path} page=${pageCount} items=${itemsThisPage} total=${results.length} hasNext=${Boolean(page.paging?.next)} nextUrlRepeated=false`
        )
      }
      if (consecutiveEmptyPages >= 2) {
        this.lastWarnings.push('Páginas vazias consecutivas — parando paginação.')
        if (dev) console.log(`[pitbrain:meta-client] paginate ${path} — 2 consecutive empty pages, stopping`)
        break
      }
    }

    if (page.paging?.next && pageCount >= maxPages) {
      this.lastWarnings.push('Limite de páginas atingido. Dados podem estar parciais.')
      if (dev) console.log(`[pitbrain:meta-client] paginate ${path} — maxPages (${maxPages}) reached`)
    }

    return results
  }
}

let sharedClient: MetaClient | null = null

/** Lazily-created singleton for the default configuration (process.env token/version). */
export function getMetaClient(): MetaClient {
  if (!sharedClient) sharedClient = new MetaClient()
  return sharedClient
}
