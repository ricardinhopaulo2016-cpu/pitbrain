'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { MetricCard } from '@/components/dashboard/MetricCard'
import {
  ShieldCheck, RefreshCw, Layers, Megaphone, Sparkles, EyeOff,
  AlertTriangle, CheckCircle2, Wifi, WifiOff, XCircle, Loader2, HelpCircle, ChevronDown,
} from 'lucide-react'
import {
  getLastMetaSync, persistMetaSyncResult, getSelectedAdAccountId, setSelectedAdAccountId,
  type StoredMetaSync,
} from '@/lib/meta/meta-storage'
import { AdAccountCombobox } from '@/components/meta/AdAccountCombobox'
import type { MetaAdAccount } from '@/lib/meta/meta-types'
import type { SyncMetaAccountResult, MetaSyncScope, MetaSyncStage, MetaSyncCounts } from '@/lib/meta/meta-service'
import { DEFAULT_SYNC_SCOPE } from '@/lib/meta/meta-service'
import type { MetaSyncErrorInfo, MetaConnectionStatus } from '@/lib/meta/meta-errors'
import { META_TOKEN_RENEWAL_MESSAGE } from '@/lib/meta/meta-errors'
import { cn } from '@/lib/utils'

type ConnectionState = 'checking' | MetaConnectionStatus
type SyncPhase = 'idle' | MetaSyncStage | 'error' | 'cancelled'

const OAUTH_ERROR_CODE = 190 // Meta's OAuthException code — covers expired, revoked, or malformed tokens
const PERMISSION_ERROR_CODE = 10
const RATE_LIMIT_CODES = [4, 17]
const GLOBAL_TIMEOUT_MS = 60_000

const STAGE_LABELS: Record<SyncPhase, string> = {
  idle: 'Aguardando',
  campaigns: 'Buscando campanhas',
  adsets: 'Buscando conjuntos',
  ads: 'Buscando anúncios',
  creatives: 'Buscando criativos',
  dark_posts: 'Extraindo dark posts',
  insights: 'Buscando insights',
  done: 'Finalizado',
  error: 'Erro',
  cancelled: 'Cancelado',
}

const EMPTY_COUNTS: MetaSyncCounts = { campaigns: 0, adsets: 0, ads: 0, creatives: 0, darkPosts: 0 }

interface StreamEvent {
  type: 'progress' | 'done' | 'error'
  stage?: MetaSyncStage
  counts?: Partial<MetaSyncCounts>
  result?: SyncMetaAccountResult
  kind?: string
  title?: string
  message?: string
  actions?: string[]
  partial?: Partial<MetaSyncCounts>
}

export default function MetaSyncPage() {
  const [connection, setConnection] = useState<ConnectionState>('checking')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [adAccounts, setAdAccounts] = useState<MetaAdAccount[]>([])
  const [defaultAdAccountId, setDefaultAdAccountId] = useState<string | null>(null)
  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [syncing, setSyncing] = useState(false)
  const [syncPhase, setSyncPhase] = useState<SyncPhase>('idle')
  const [syncCounts, setSyncCounts] = useState<MetaSyncCounts>(EMPTY_COUNTS)
  const [syncError, setSyncError] = useState<MetaSyncErrorInfo | null>(null)
  const [syncIncomplete, setSyncIncomplete] = useState(false)
  const [lastSync, setLastSync] = useState<StoredMetaSync | null>(null)
  const [scope, setScope] = useState<MetaSyncScope>(DEFAULT_SYNC_SCOPE)
  const [showRenewalHelp, setShowRenewalHelp] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const cancelledRef = useRef(false)

  const loadAdAccounts = useCallback(async () => {
    setConnection('checking')
    setConnectionError(null)
    try {
      const res = await fetch('/api/meta/ad-accounts')
      const json = await res.json()

      if (!res.ok) {
        if (json.kind === 'missing_token') {
          setConnection('missing_token')
        } else if (json.kind === 'api_error' && json.code === OAUTH_ERROR_CODE) {
          setConnection('expired_token')
        } else if (json.kind === 'api_error' && json.code === PERMISSION_ERROR_CODE) {
          setConnection('permission_error')
        } else if (json.kind === 'api_error' && (RATE_LIMIT_CODES.includes(json.code) || res.status === 429)) {
          setConnection('rate_limited')
        } else {
          setConnection('unknown_error')
        }
        setConnectionError(json.error ?? 'Erro ao conectar com a Meta API.')
        return
      }

      const accounts: MetaAdAccount[] = json.adAccounts ?? []
      setAdAccounts(accounts)
      setDefaultAdAccountId(json.defaultAdAccountId ?? null)
      setConnection('connected')
    } catch (err) {
      setConnection('unknown_error')
      setConnectionError(err instanceof Error ? err.message : 'Erro ao conectar com a Meta API.')
    }
  }, [])

  useEffect(() => {
    loadAdAccounts()
  }, [loadAdAccounts])

  // Lightweight check only — GET /api/meta/ad-accounts, never triggers a full sync.
  async function handleTestConnection() {
    if (testingConnection || syncing) return
    setTestingConnection(true)
    await loadAdAccounts()
    setTestingConnection(false)
  }

  // Initial selection priority: stored choice → env default → first account — only once, on load.
  useEffect(() => {
    if (adAccounts.length === 0 || selectedAccountId) return

    const stored = getSelectedAdAccountId()
    if (stored && adAccounts.some(a => a.id === stored)) {
      setSelectedAccountId(stored)
      return
    }
    if (defaultAdAccountId && adAccounts.some(a => a.id === defaultAdAccountId)) {
      setSelectedAccountId(defaultAdAccountId)
      return
    }
    setSelectedAccountId(adAccounts[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adAccounts, defaultAdAccountId])

  useEffect(() => {
    setLastSync(getLastMetaSync(selectedAccountId || undefined))
  }, [selectedAccountId])

  function handleSelectAccount(id: string) {
    // Switching accounts must never auto-start a sync — only clear stale state.
    setSelectedAccountId(id)
    setSelectedAdAccountId(id)
    setSyncError(null)
    setSyncIncomplete(false)
    setSyncPhase('idle')
    setSyncCounts(EMPTY_COUNTS)
  }

  function handleClearSelection() {
    setSelectedAccountId('')
    setSelectedAdAccountId(null)
    setSyncError(null)
    setSyncIncomplete(false)
    setSyncPhase('idle')
    setSyncCounts(EMPTY_COUNTS)
  }

  async function handleSync() {
    if (!selectedAccountId || syncing) return

    // Token already known to be expired/invalid/unauthorized — abort before
    // attempting any campaigns/adsets/ads fetch.
    if (connection !== 'connected') {
      setSyncError({
        kind: connection === 'permission_error' ? 'permission_error' : connection === 'rate_limited' ? 'rate_limit' : 'token',
        title: connection === 'permission_error'
          ? 'Token sem permissão suficiente'
          : connection === 'rate_limited'
          ? 'Limite temporário da Meta atingido'
          : 'Token da Meta expirado ou inválido',
        message: connection === 'permission_error'
          ? 'O token não tem a permissão ads_read. Gere um novo token com essa permissão.'
          : connection === 'rate_limited'
          ? 'Aguarde alguns minutos antes de tentar novamente.'
          : META_TOKEN_RENEWAL_MESSAGE,
      })
      setSyncPhase('error')
      return
    }

    const controller = new AbortController()
    abortControllerRef.current = controller
    cancelledRef.current = false
    const timeoutTimer = setTimeout(() => controller.abort(), GLOBAL_TIMEOUT_MS)

    setSyncing(true)
    setSyncError(null)
    setSyncIncomplete(false)
    setSyncPhase('campaigns')
    setSyncCounts(EMPTY_COUNTS)

    try {
      const res = await fetch('/api/meta/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adAccountId: selectedAccountId, scope }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setSyncError({
          kind: 'internal',
          title: 'Erro ao sincronizar',
          message: json.error ?? 'Erro ao sincronizar com a Meta API.',
        })
        setSyncPhase('error')
        setSyncIncomplete(true)
        return
      }
      if (!res.body) throw new Error('Resposta vazia do servidor.')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let finalResult: SyncMetaAccountResult | undefined
      let streamError: StreamEvent | undefined

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          const event = JSON.parse(line) as StreamEvent
          if (event.type === 'progress' && event.stage) {
            setSyncPhase(event.stage)
            if (event.counts) setSyncCounts(prev => ({ ...prev, ...event.counts }))
          } else if (event.type === 'done') {
            finalResult = event.result
          } else if (event.type === 'error') {
            streamError = event
          }
        }
      }

      if (streamError) {
        setSyncError({
          kind: (streamError.kind as MetaSyncErrorInfo['kind']) ?? 'internal',
          title: streamError.title ?? 'Erro ao sincronizar',
          message: streamError.message ?? 'Erro desconhecido ao sincronizar com a Meta API.',
          actions: streamError.actions,
        })
        setSyncPhase(streamError.kind === 'cancelled' ? 'cancelled' : 'error')
        setSyncIncomplete(true)
        if (streamError.partial) setSyncCounts(prev => ({ ...prev, ...streamError.partial }))
        return
      }

      if (finalResult) {
        persistMetaSyncResult(finalResult)
        setLastSync(getLastMetaSync(selectedAccountId))
        setSyncPhase('done')
      }
    } catch (err) {
      if (controller.signal.aborted) {
        if (cancelledRef.current) {
          setSyncError({ kind: 'cancelled', title: 'Sync cancelado', message: 'Sync cancelado pelo usuário.' })
          setSyncPhase('cancelled')
        } else {
          setSyncError({
            kind: 'timeout',
            title: 'Sync interrompido por demora',
            message: 'O sync demorou demais e foi interrompido. Reduza o escopo e tente novamente.',
          })
          setSyncPhase('error')
        }
      } else {
        setSyncError({
          kind: 'internal',
          title: 'Erro ao sincronizar',
          message: err instanceof Error ? err.message : 'Erro ao sincronizar com a Meta API.',
        })
        setSyncPhase('error')
      }
      setSyncIncomplete(true)
    } finally {
      clearTimeout(timeoutTimer)
      abortControllerRef.current = null
      setSyncing(false)
    }
  }

  function handleCancelSync() {
    cancelledRef.current = true
    abortControllerRef.current?.abort()
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Meta Sync"
        chips={[
          {
            label: connection === 'connected' ? 'Conectado'
              : connection === 'expired_token' ? 'Token expirado'
              : connection === 'permission_error' ? 'Sem permissão'
              : connection === 'rate_limited' ? 'Limite atingido'
              : connection === 'missing_token' ? 'Não configurado'
              : 'Sem conexão',
            icon: connection === 'connected' ? Wifi : WifiOff,
          },
          ...(selectedAccountId ? [{ label: selectedAccountId }] : []),
        ]}
        action={{
          label: syncing ? 'Cancelar sync' : 'Sincronizar Meta',
          icon: syncing ? XCircle : RefreshCw,
          onClick: syncing ? handleCancelSync : handleSync,
        }}
      />

      {/* Fixed read-only mode notice */}
      <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
        <EyeOff className="h-4 w-4 text-pb-blue shrink-0" />
        <p className="text-sm text-pb-text">
          <span className="font-semibold">Modo leitura.</span> Nenhuma campanha será criada, editada ou publicada.
        </p>
      </div>

      {/* "How to renew token?" — always available, doesn't depend on connection state */}
      <div className="rounded-xl border border-pb-border overflow-hidden">
        <button
          onClick={() => setShowRenewalHelp(v => !v)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-pb-card hover:bg-pb-card-alt transition-colors"
        >
          <span className="flex items-center gap-2 text-sm text-pb-text font-medium">
            <HelpCircle className="h-4 w-4 text-pb-purple" />
            Como renovar token?
          </span>
          <ChevronDown className={cn('h-4 w-4 text-pb-muted transition-transform', showRenewalHelp && 'rotate-180')} />
        </button>
        {showRenewalHelp && (
          <div className="px-4 py-4 space-y-4 text-xs text-pb-muted bg-pb-card-alt">
            <div>
              <p className="text-pb-text font-semibold mb-2">Opção rápida: Graph API Explorer</p>
              <ol className="space-y-1.5 list-decimal list-inside">
                <li>Abra <span className="text-pb-text">Meta Developers → Graph API Explorer</span>.</li>
                <li>Selecione o app <span className="text-pb-text">PITBRAIN</span>.</li>
                <li>Adicione a permissão <span className="text-pb-text font-mono">ads_read</span>.</li>
                <li>Gere o novo token.</li>
                <li>Atualize <span className="text-pb-text font-mono">META_ACCESS_TOKEN</span> na Vercel.</li>
                <li>Faça <span className="text-pb-text">Redeploy</span>.</li>
              </ol>
            </div>
            <div className="pt-3" style={{ borderTop: '1px solid rgba(42,42,64,0.5)' }}>
              <p className="text-pb-text font-semibold mb-2">Opção recomendada: System User Token</p>
              <p className="text-[11px] text-pb-muted/80 mb-2">Não expira automaticamente — melhor para uso contínuo em produção.</p>
              <ol className="space-y-1.5 list-decimal list-inside">
                <li>Acesse <span className="text-pb-text">Business Settings</span>.</li>
                <li>Vá em <span className="text-pb-text">Usuários do sistema</span>.</li>
                <li>Crie ou selecione um usuário do sistema.</li>
                <li>Dê acesso à conta de anúncios.</li>
                <li>Gere um token com a permissão <span className="text-pb-text font-mono">ads_read</span>.</li>
                <li>Atualize <span className="text-pb-text font-mono">META_ACCESS_TOKEN</span> na Vercel e faça Redeploy.</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Manual connection check — GET /api/meta/ad-accounts only, no sync */}
      <div>
        <button
          onClick={handleTestConnection}
          disabled={testingConnection || syncing || connection === 'checking'}
          className="inline-flex items-center gap-2 text-sm font-medium text-pb-text bg-pb-card border border-pb-border rounded-lg px-3.5 py-2 hover:bg-pb-card-alt transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testingConnection ? <Loader2 className="h-4 w-4 animate-spin text-pb-purple" /> : <Wifi className="h-4 w-4 text-pb-purple" />}
          Testar conexão
        </button>
      </div>

      {/* Connection / account status */}
      {connection === 'missing_token' && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-4" style={{ background: 'rgba(250, 204, 21, 0.06)', border: '1px solid rgba(250, 204, 21, 0.25)' }}>
          <AlertTriangle className="h-4 w-4 text-pb-yellow shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-pb-text">Configure META_ACCESS_TOKEN no .env.local</p>
            <p className="text-xs text-pb-muted mt-1">
              {connectionError ?? 'A integração com a Meta Marketing API precisa de um access token válido para listar contas de anúncio.'}
            </p>
          </div>
        </div>
      )}

      {connection === 'expired_token' && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-4" style={{ background: 'rgba(250, 204, 21, 0.06)', border: '1px solid rgba(250, 204, 21, 0.25)' }}>
          <AlertTriangle className="h-4 w-4 text-pb-yellow shrink-0 mt-0.5" />
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-pb-text">Token da Meta expirado ou inválido</p>
              <p className="text-xs text-pb-muted mt-1">{META_TOKEN_RENEWAL_MESSAGE}</p>
            </div>
            <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <p className="text-xs font-semibold text-pb-red">
                Token atual inválido. Atualize as variáveis de ambiente e faça Redeploy.
              </p>
            </div>
            <div className="text-[11px] text-pb-muted space-y-0.5">
              <p><span className="text-pb-text font-medium">Local:</span> atualize .env.local e reinicie <span className="font-mono">npm run dev</span>.</p>
              <p><span className="text-pb-text font-medium">Vercel:</span> Project Settings → Environment Variables → META_ACCESS_TOKEN e faça Redeploy.</p>
            </div>
          </div>
        </div>
      )}

      {connection === 'permission_error' && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-4" style={{ background: 'rgba(250, 204, 21, 0.06)', border: '1px solid rgba(250, 204, 21, 0.25)' }}>
          <AlertTriangle className="h-4 w-4 text-pb-yellow shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-pb-text">Token sem permissão suficiente</p>
            <p className="text-xs text-pb-muted mt-1">
              {connectionError ?? 'O token não tem a permissão ads_read.'} Gere um novo token com essa permissão e atualize META_ACCESS_TOKEN.
            </p>
          </div>
        </div>
      )}

      {connection === 'rate_limited' && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-4" style={{ background: 'rgba(250, 204, 21, 0.06)', border: '1px solid rgba(250, 204, 21, 0.25)' }}>
          <AlertTriangle className="h-4 w-4 text-pb-yellow shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-pb-text">Limite temporário da Meta atingido</p>
            <p className="text-xs text-pb-muted mt-1">Aguarde 30–60 minutos antes de tentar novamente.</p>
          </div>
        </div>
      )}

      {connection === 'unknown_error' && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-4" style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
          <AlertTriangle className="h-4 w-4 text-pb-red shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-pb-text">Erro ao conectar com a Meta API</p>
            <p className="text-xs text-pb-muted mt-1">{connectionError}</p>
          </div>
        </div>
      )}

      {connection === 'connected' && (
        <div className="bg-pb-card border border-pb-border rounded-xl p-4 flex flex-wrap items-start gap-4">
          <div className="flex items-center gap-2 pt-6 shrink-0">
            <CheckCircle2 className="h-4 w-4 text-pb-green" />
            <span className="text-sm text-pb-text font-medium">Conectado à Meta Marketing API</span>
          </div>
          {adAccounts.length > 0 && (
            <div className="ml-auto w-full sm:w-auto">
              <AdAccountCombobox
                accounts={adAccounts}
                selectedId={selectedAccountId}
                onSelect={handleSelectAccount}
                onClear={handleClearSelection}
              />
            </div>
          )}
        </div>
      )}

      {/* Sync scope controls */}
      {connection === 'connected' && (
        <div className="bg-pb-card border border-pb-border rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-pb-border font-semibold mb-3">Escopo do sync</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="text-xs text-pb-muted space-y-1 block">
              <span className="block">Status</span>
              <select
                value={scope.status}
                disabled={syncing}
                onChange={e => setScope(s => ({ ...s, status: e.target.value === 'all' ? 'all' : 'active' }))}
                className="w-full bg-pb-card-alt border border-pb-border rounded-lg px-2.5 py-1.5 text-sm text-pb-text disabled:opacity-50"
              >
                <option value="active">Ativas</option>
                <option value="all">Todas</option>
              </select>
            </label>

            <label className="text-xs text-pb-muted space-y-1 block">
              <span className="block">Limite de campanhas</span>
              <select
                value={scope.campaignLimit}
                disabled={syncing}
                onChange={e => setScope(s => ({ ...s, campaignLimit: Number(e.target.value) }))}
                className="w-full bg-pb-card-alt border border-pb-border rounded-lg px-2.5 py-1.5 text-sm text-pb-text disabled:opacity-50"
              >
                {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>

            <label className="text-xs text-pb-muted space-y-1 block">
              <span className="block">Limite de anúncios</span>
              <select
                value={scope.adLimit}
                disabled={syncing}
                onChange={e => setScope(s => ({ ...s, adLimit: Number(e.target.value) }))}
                className="w-full bg-pb-card-alt border border-pb-border rounded-lg px-2.5 py-1.5 text-sm text-pb-text disabled:opacity-50"
              >
                {[50, 100, 250].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>

            <label className="text-xs text-pb-muted space-y-1 block">
              <span className="block">Nome contém</span>
              <input
                type="text"
                value={scope.nameContains ?? ''}
                disabled={syncing}
                onChange={e => setScope(s => ({ ...s, nameContains: e.target.value }))}
                placeholder="Opcional"
                className="w-full bg-pb-card-alt border border-pb-border rounded-lg px-2.5 py-1.5 text-sm text-pb-text placeholder:text-pb-muted/50 disabled:opacity-50"
              />
            </label>
          </div>

          <label className="flex items-start gap-2.5 mt-4 cursor-pointer">
            <input
              type="checkbox"
              checked={scope.includeInsights}
              disabled={syncing}
              onChange={e => setScope(s => ({ ...s, includeInsights: e.target.checked }))}
              className="mt-0.5 accent-pb-purple"
            />
            <span>
              <span className="block text-sm text-pb-text">Incluir insights de performance</span>
              <span className="block text-xs text-pb-muted">Insights fazem mais chamadas e podem bater limite da Meta.</span>
            </span>
          </label>
        </div>
      )}

      {/* Live sync progress */}
      {syncing && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
          <Loader2 className="h-4 w-4 text-pb-purple shrink-0 animate-spin" />
          <p className="text-sm text-pb-text">{STAGE_LABELS[syncPhase]}…</p>
        </div>
      )}

      {syncError && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-4" style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
          <AlertTriangle className="h-4 w-4 text-pb-red shrink-0 mt-0.5" />
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold text-pb-text">{syncError.title}</p>
              <p className="text-xs text-pb-muted mt-1">{syncError.message}</p>
              {syncIncomplete && <p className="text-xs text-pb-yellow mt-1 font-medium">Sync incompleto — dados parciais mantidos abaixo.</p>}
            </div>
            {syncError.actions && syncError.actions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {syncError.actions.map(action => (
                  <span key={action} className="text-xs text-pb-muted border border-pb-border rounded-lg px-2.5 py-1">
                    {action}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sync summary */}
      <div>
        {(() => {
          const showLiveCounts = syncing || syncIncomplete
          return (
            <>
              <p className="text-[10px] uppercase tracking-[0.18em] text-pb-border font-semibold mb-3">
                {showLiveCounts
                  ? `Progresso — ${STAGE_LABELS[syncPhase]}`
                  : `Último sync${lastSync ? ` — ${new Date(lastSync.syncedAt).toLocaleString('pt-BR')}` : ''}`}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <MetricCard title="Campanhas" value={String((showLiveCounts ? syncCounts.campaigns : lastSync?.counts.campaigns) ?? 0)} icon={Megaphone} highlight="blue" />
                <MetricCard title="Conjuntos" value={String((showLiveCounts ? syncCounts.adsets : lastSync?.counts.adsets) ?? 0)} icon={Layers} highlight="neutral" />
                <MetricCard title="Anúncios" value={String((showLiveCounts ? syncCounts.ads : lastSync?.counts.ads) ?? 0)} icon={Sparkles} highlight="neutral" />
                <MetricCard title="Criativos" value={String((showLiveCounts ? syncCounts.creatives : lastSync?.counts.creatives) ?? 0)} icon={ShieldCheck} highlight="neutral" />
                <MetricCard title="Dark Posts" value={String((showLiveCounts ? syncCounts.darkPosts : lastSync?.counts.darkPosts) ?? 0)} icon={EyeOff} highlight="good" />
              </div>
              {!lastSync && !syncing && !syncIncomplete && (
                <p className="text-xs text-pb-muted mt-4">Nenhum sync realizado ainda. Clique em &quot;Sincronizar Meta&quot; para importar a estrutura da conta.</p>
              )}
            </>
          )
        })()}
      </div>
    </PageShell>
  )
}
