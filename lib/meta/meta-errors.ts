import { NextResponse } from 'next/server'

export class MetaAPIError extends Error {
  readonly status?: number
  readonly code?: number
  readonly fbtraceId?: string

  constructor(message: string, status?: number, code?: number, fbtraceId?: string) {
    super(message)
    this.name = 'MetaAPIError'
    this.status = status
    this.code = code
    this.fbtraceId = fbtraceId
  }
}

export class MissingMetaTokenError extends Error {
  constructor(message = 'Configure META_ACCESS_TOKEN no .env.local.') {
    super(message)
    this.name = 'MissingMetaTokenError'
  }
}

export class MetaWriteDisabledError extends Error {
  constructor() {
    super('Meta write actions are disabled in this MVP.')
    this.name = 'MetaWriteDisabledError'
  }
}

/** Thrown internally to unwind a sync in progress — caught by the route handler, never surfaced by its message. */
export class SyncAbortedError extends Error {
  constructor(reason: 'timeout' | 'cancelled') {
    super(`Sync aborted: ${reason}`)
    this.name = 'SyncAbortedError'
  }
}

const OAUTH_ERROR_CODE = 190 // Meta's OAuthException code — expired, revoked, or malformed token
const PERMISSION_ERROR_CODE = 10 // Meta's "Permission Error" code — token valid but missing a scope (e.g. ads_read)
// Meta reports rate limiting via HTTP 429, error codes 4 (app-level) / 17 (user-level),
// or occasionally only through the message text — so all three are checked.
const RATE_LIMIT_MESSAGE_PATTERN = /user request limit reached|application request limit reached|too many calls/i
const PERMISSION_MESSAGE_PATTERN = /does not have permission|missing permission|permiss(ão|ões)/i
// Meta's Session-expiry/OAuth error text — used to tell "session expired" apart from other 190s.
const TOKEN_EXPIRED_MESSAGE_PATTERN = /session has expired|error validating access token|token.*expired|expired.*token/i

export function isMetaRateLimitError(err: unknown): boolean {
  if (!(err instanceof MetaAPIError)) return false
  if (err.status === 429) return true
  if (err.code === 4 || err.code === 17) return true
  return RATE_LIMIT_MESSAGE_PATTERN.test(err.message)
}

function isMetaTokenError(err: unknown): boolean {
  if (!(err instanceof MetaAPIError)) return false
  if (err.code === OAUTH_ERROR_CODE) return true
  return TOKEN_EXPIRED_MESSAGE_PATTERN.test(err.message)
}

function isMetaPermissionError(err: unknown): boolean {
  if (!(err instanceof MetaAPIError)) return false
  if (err.code === PERMISSION_ERROR_CODE) return true
  return PERMISSION_MESSAGE_PATTERN.test(err.message)
}

/** Same classification used by the sync route, exposed for the connection-check UI. */
export type MetaConnectionStatus =
  | 'connected'
  | 'missing_token'
  | 'expired_token'
  | 'permission_error'
  | 'rate_limited'
  | 'unknown_error'

export const META_TOKEN_RENEWAL_MESSAGE =
  'Gere um novo token da Meta e atualize META_ACCESS_TOKEN nas variáveis de ambiente.'

// Meta's Graph API returns HTTP 400 for almost every OAuthException — including a
// merely-expired/invalid token — so the client can't tell "not configured" apart from
// "configured but stale" by status code alone. `kind` makes that distinction explicit.
export type MetaErrorKind =
  | 'missing_token'
  | 'write_disabled'
  | 'api_error'
  | 'internal'
  | 'rate_limit'
  | 'timeout'
  | 'cancelled'
  | 'token'
  | 'permission_error'

export interface MetaSyncErrorInfo {
  kind: MetaErrorKind
  title: string
  message: string
  actions?: string[]
}

/** Friendly PT-BR title/message/actions for the sync error card — shared between the stream route and any future non-streaming caller. */
export function buildMetaSyncErrorInfo(err: unknown, abortReason?: 'timeout' | 'cancelled'): MetaSyncErrorInfo {
  if (abortReason === 'cancelled') {
    return { kind: 'cancelled', title: 'Sync cancelado', message: 'Sync cancelado pelo usuário.' }
  }
  if (abortReason === 'timeout') {
    return {
      kind: 'timeout',
      title: 'Sync interrompido por demora',
      message: 'Sync interrompido por demora excessiva. Reduza o limite de campanhas/anúncios.',
      actions: ['Reduzir escopo', 'Usar último sync válido'],
    }
  }
  if (isMetaRateLimitError(err)) {
    return {
      kind: 'rate_limit',
      title: 'Limite temporário da Meta atingido',
      message: 'A Meta recusou novas chamadas por excesso de requisições. Aguarde 30–60 minutos ou reduza o escopo do sync.',
      actions: ['Tentar novamente depois', 'Reduzir escopo', 'Usar último sync válido'],
    }
  }
  if (err instanceof MissingMetaTokenError) {
    return { kind: 'missing_token', title: 'Meta não configurada', message: err.message }
  }
  if (isMetaTokenError(err)) {
    return { kind: 'token', title: 'Token da Meta expirado ou inválido', message: META_TOKEN_RENEWAL_MESSAGE }
  }
  if (isMetaPermissionError(err)) {
    return {
      kind: 'permission_error',
      title: 'Token sem permissão suficiente',
      message: 'O token não tem a permissão ads_read. Gere um novo token com essa permissão e atualize META_ACCESS_TOKEN.',
    }
  }
  return {
    kind: 'internal',
    title: 'Erro ao sincronizar',
    message: err instanceof Error ? err.message : 'Erro desconhecido ao sincronizar com a Meta API.',
  }
}

/** Shared error → HTTP response mapping for every app/api/meta/* route. */
export function metaErrorResponse(err: unknown, routeName: string): NextResponse {
  if (process.env.NODE_ENV === 'development') {
    console.error(`[pitbrain:meta:${routeName}]`, err instanceof Error ? err.message : err)
  }

  if (err instanceof MissingMetaTokenError) {
    return NextResponse.json({ error: err.message, kind: 'missing_token' satisfies MetaErrorKind }, { status: 400 })
  }
  if (err instanceof MetaWriteDisabledError) {
    return NextResponse.json({ error: err.message, kind: 'write_disabled' satisfies MetaErrorKind }, { status: 403 })
  }
  if (err instanceof MetaAPIError) {
    return NextResponse.json(
      { error: err.message, kind: 'api_error' satisfies MetaErrorKind, code: err.code, fbtraceId: err.fbtraceId },
      { status: err.status ?? 502 }
    )
  }

  const detail = err instanceof Error ? err.message : String(err)
  return NextResponse.json(
    { error: 'Erro interno ao consultar a Meta API.', kind: 'internal' satisfies MetaErrorKind, detail },
    { status: 500 }
  )
}
