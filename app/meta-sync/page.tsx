'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { MetricCard } from '@/components/dashboard/MetricCard'
import {
  ShieldCheck, RefreshCw, Layers, Megaphone, Sparkles, EyeOff,
  AlertTriangle, CheckCircle2, Wifi, WifiOff, XCircle, Loader2, HelpCircle, ChevronDown,
  Gauge, BarChart2,
} from 'lucide-react'
import {
  getLastMetaSync, persistMetaSyncResult, persistPartialMetaSyncResult,
  getSelectedAdAccountId, setSelectedAdAccountId, type StoredMetaSync,
} from '@/lib/meta/meta-storage'
import { AdAccountCombobox } from '@/components/meta/AdAccountCombobox'
import type { MetaAdAccount, MetaInsight } from '@/lib/meta/meta-types'
import type {
  SyncMetaAccountResult, MetaSyncScope, MetaSyncStage, MetaSyncCounts, MetaSyncCheckpointData,
} from '@/lib/meta/meta-service'
import { DEFAULT_SYNC_SCOPE } from '@/lib/meta/meta-service'
import type { MetaSyncErrorInfo, MetaConnectionStatus } from '@/lib/meta/meta-errors'
import { META_TOKEN_RENEWAL_MESSAGE } from '@/lib/meta/meta-errors'
import { GLOBAL_TIMEOUT_MS } from '@/lib/meta/meta-sync-constants'
import { SYNC_PRESETS, DEFAULT_INSIGHTS_SCOPE, buildSyncPlan, planNeedsConfirmation, type MetaSyncPresetId } from '@/lib/meta/meta-sync-plan'
import { cn } from '@/lib/utils'

type ConnectionState = 'checking' | MetaConnectionStatus
type SyncPhase = 'idle' | MetaSyncStage | 'error' | 'cancelled'

const OAUTH_ERROR_CODE = 190 // Meta's OAuthException code — covers expired, revoked, or malformed tokens
const PERMISSION_ERROR_CODE = 10
const RATE_LIMIT_CODES = [4, 17]

const STAGE_LABELS: Record<SyncPhase, string> = {
  idle: 'Aguardando',
  campaigns: 'Buscando campanhas',
  adsets: 'Buscando conjuntos',
  ads: 'Buscando anúncios',
  creatives: 'Buscando criativos',
  dark_posts: 'Extraindo dark posts',
  done: 'Finalizado',
  error: 'Erro',
  cancelled: 'Cancelado',
}

const EMPTY_COUNTS: MetaSyncCounts = { campaigns: 0, adsets: 0, ads: 0, creatives: 0, darkPosts: 0 }

interface StreamEvent {
  type: 'progress' | 'done' | 'error'
  stage?: MetaSyncStage
  counts?: Partial<MetaSyncCounts>
  data?: MetaSyncCheckpointData
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
  const [emptyReason, setEmptyReason] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<StoredMetaSync | null>(null)
  const [scope, setScope] = useState<MetaSyncScope>(DEFAULT_SYNC_SCOPE)
  const [selectedPreset, setSelectedPreset] = useState<MetaSyncPresetId | 'custom'>('seguro')
  const [showConfirm, setShowConfirm] = useState(false)
  const [forceRefreshCreatives, setForceRefreshCreatives] = useState(false)
  const [showRenewalHelp, setShowRenewalHelp] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)

  const [insightsSyncing, setInsightsSyncing] = useState(false)
  const [insightsError, setInsightsError] = useState<string | null>(null)
  const [insightsResult, setInsightsResult] = useState<MetaInsight[] | null>(null)
  const [showInsightsConfirm, setShowInsightsConfirm] = useState(false)

  // Debug/diagnostics for the current or most recent sync run — purely client-side, not persisted.
  const [syncWarnings, setSyncWarnings] = useState<string[]>([])
  const [debugEvents, setDebugEvents] = useState<{ time: string; message: string }[]>([])
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const [syncStartedAt, setSyncStartedAt] = useState<number | null>(null)
  const [syncFinishedAt, setSyncFinishedAt] = useState<number | null>(null)
  const [stuckSeconds, setStuckSeconds] = useState(0)
  const lastEventAtRef = useRef<number>(Date.now())

  const abortControllerRef = useRef<AbortController | null>(null)
  const cancelledRef = useRef(false)

  function pushDebugEvent(message: string) {
    setDebugEvents(prev => [...prev.slice(-9), { time: new Date().toLocaleTimeString('pt-BR'), message }])
  }

  // Ticks "há Xs desde a última atualização" while a sync is running — the same signal the
  // server-side stall watchdog uses, shown to the user instead of just a silent spinner.
  useEffect(() => {
    if (!syncing) return
    const interval = setInterval(() => {
      setStuckSeconds(Math.floor((Date.now() - lastEventAtRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [syncing])

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
    setEmptyReason(null)
    setInsightsResult(null)
    setInsightsError(null)
    setShowInsightsConfirm(false)
    setSyncWarnings([])
    setDebugEvents([])
  }

  function handleClearSelection() {
    setSelectedAccountId('')
    setSelectedAdAccountId(null)
    setSyncError(null)
    setSyncIncomplete(false)
    setSyncPhase('idle')
    setSyncCounts(EMPTY_COUNTS)
    setEmptyReason(null)
    setShowInsightsConfirm(false)
    setSyncWarnings([])
    setDebugEvents([])
  }

  function applyPreset(id: MetaSyncPresetId) {
    const preset = SYNC_PRESETS.find(p => p.id === id)
    if (!preset) return
    setScope(preset.scope)
    setSelectedPreset(id)
    setShowConfirm(false)
  }

  function updateScope(patch: Partial<MetaSyncScope>) {
    setScope(s => ({ ...s, ...patch }))
    setSelectedPreset('custom')
    setShowConfirm(false)
  }

  const plan = useMemo(
    () => (selectedAccountId ? buildSyncPlan(selectedAccountId, scope) : null),
    [selectedAccountId, scope]
  )

  function handleSyncClick() {
    if (!selectedAccountId || syncing) return

    // Token already known to be expired/invalid/unauthorized — abort before
    // attempting any campaigns/adsets/ads fetch. isSyncing never flips to true here.
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

    if (plan && planNeedsConfirmation(plan) && !showConfirm) {
      setShowConfirm(true)
      return
    }
    setShowConfirm(false)
    void runSync()
  }

  async function runSync() {
    setShowConfirm(false) // one-time confirmation per click — re-asks next time a heavy scope is run
    const controller = new AbortController()
    abortControllerRef.current = controller
    cancelledRef.current = false
    const timeoutTimer = setTimeout(() => controller.abort(), GLOBAL_TIMEOUT_MS)

    setSyncing(true)
    setSyncError(null)
    setSyncIncomplete(false)
    setEmptyReason(null)
    setSyncPhase('campaigns')
    setSyncCounts(EMPTY_COUNTS)
    setSyncWarnings([])
    setDebugEvents([])
    setSyncStartedAt(Date.now())
    setSyncFinishedAt(null)
    setStuckSeconds(0)
    lastEventAtRef.current = Date.now()
    pushDebugEvent('Validando token e iniciando sync')

    const accountName = adAccounts.find(a => a.id === selectedAccountId)?.name
    const accumulated: MetaSyncCheckpointData = {}
    let liveCounts: Partial<MetaSyncCounts> = {}

    try {
      const res = await fetch('/api/meta/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adAccountId: selectedAccountId,
          adAccountName: accountName,
          scope,
          forceRefreshCreatives,
        }),
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
            lastEventAtRef.current = Date.now()
            setStuckSeconds(0)
            setSyncPhase(event.stage)
            if (event.counts) {
              liveCounts = { ...liveCounts, ...event.counts }
              setSyncCounts(prev => ({ ...prev, ...event.counts }))
              const countsSummary = Object.entries(event.counts)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ')
              pushDebugEvent(`${STAGE_LABELS[event.stage] ?? event.stage}${countsSummary ? ` — ${countsSummary}` : ''}`)
            }
            if (event.data) Object.assign(accumulated, event.data)
          } else if (event.type === 'done') {
            finalResult = event.result
            pushDebugEvent('Sync finalizado')
          } else if (event.type === 'error') {
            streamError = event
            pushDebugEvent(`Erro: ${event.title ?? event.kind ?? 'desconhecido'}`)
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
        setSyncFinishedAt(Date.now())
        if (streamError.partial) setSyncCounts(prev => ({ ...prev, ...streamError.partial }))
        persistPartialMetaSyncResult({
          adAccountId: selectedAccountId,
          syncedAt: new Date().toISOString(),
          campaigns: accumulated.campaigns,
          adsets: accumulated.adsets,
          ads: accumulated.ads,
          darkPosts: accumulated.darkPosts,
          counts: liveCounts,
        })
        setLastSync(getLastMetaSync(selectedAccountId))
        return
      }

      if (finalResult) {
        if (finalResult.emptyReason) setEmptyReason(finalResult.emptyReason)
        if (finalResult.warnings) setSyncWarnings(finalResult.warnings)
        persistMetaSyncResult(finalResult)
        setLastSync(getLastMetaSync(selectedAccountId))
        setSyncPhase('done')
        setSyncFinishedAt(Date.now())
      }
    } catch (err) {
      setSyncFinishedAt(Date.now())
      if (controller.signal.aborted) {
        if (cancelledRef.current) {
          setSyncError({ kind: 'cancelled', title: 'Sync cancelado', message: 'Sync cancelado pelo usuário.' })
          setSyncPhase('cancelled')
          pushDebugEvent('Sync cancelado pelo usuário')
        } else {
          setSyncError({
            kind: 'timeout',
            title: 'Sync interrompido por demora',
            message: 'O sync demorou demais e foi interrompido. Reduza o escopo e tente novamente.',
            actions: ['Reduzir escopo', 'Usar último sync válido'],
          })
          setSyncPhase('error')
          pushDebugEvent('Sync interrompido por timeout no cliente')
        }
      } else {
        setSyncError({
          kind: 'internal',
          title: 'Erro ao sincronizar',
          message: err instanceof Error ? err.message : 'Erro ao sincronizar com a Meta API.',
        })
        setSyncPhase('error')
        pushDebugEvent('Erro inesperado no cliente')
      }
      setSyncIncomplete(true)
      persistPartialMetaSyncResult({
        adAccountId: selectedAccountId,
        syncedAt: new Date().toISOString(),
        campaigns: accumulated.campaigns,
        adsets: accumulated.adsets,
        ads: accumulated.ads,
        darkPosts: accumulated.darkPosts,
        counts: liveCounts,
      })
      setLastSync(getLastMetaSync(selectedAccountId))
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

  async function handleUseLastSync() {
    if (!selectedAccountId) return
    try {
      const res = await fetch(`/api/meta/sync/last?adAccountId=${encodeURIComponent(selectedAccountId)}`)
      const json = await res.json()
      const row = json?.sync
      if (row) {
        persistPartialMetaSyncResult({
          adAccountId: row.ad_account_id,
          syncedAt: row.updated_at ?? row.created_at,
          campaigns: row.campaigns ?? [],
          adsets: row.adsets ?? [],
          ads: row.ads ?? [],
          darkPosts: row.dark_posts ?? [],
          counts: row.counts ?? undefined,
        })
      }
    } catch {
      // fall through to whatever's already in localStorage below
    }
    setLastSync(getLastMetaSync(selectedAccountId))
    setSyncError(null)
    setSyncIncomplete(false)
    setSyncPhase('idle')
  }

  function handleErrorAction(action: string) {
    if (action === 'Reduzir escopo') applyPreset('seguro')
    else if (action === 'Tentar novamente depois') { setSyncError(null); setSyncPhase('idle') }
    else if (action === 'Usar último sync válido') void handleUseLastSync()
  }

  // Insights make extra Meta calls on top of Structure Sync, so the button requires an explicit
  // second click to confirm before it actually fetches — mirrors the heavy-scope confirm banner.
  function handleInsightsSyncClick() {
    if (!selectedAccountId || insightsSyncing) return
    if (!showInsightsConfirm) {
      setShowInsightsConfirm(true)
      return
    }
    setShowInsightsConfirm(false)
    void runInsightsSync()
  }

  async function runInsightsSync() {
    if (!selectedAccountId || insightsSyncing) return
    setInsightsSyncing(true)
    setInsightsError(null)
    try {
      const params = new URLSearchParams({
        adAccountId: selectedAccountId,
        level: DEFAULT_INSIGHTS_SCOPE.level,
        datePreset: DEFAULT_INSIGHTS_SCOPE.datePreset,
        limit: String(DEFAULT_INSIGHTS_SCOPE.limit),
      })
      const res = await fetch(`/api/meta/insights?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        setInsightsError(json.error ?? 'Erro ao buscar insights.')
        return
      }
      setInsightsResult(json.insights ?? [])
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : 'Erro ao buscar insights.')
    } finally {
      setInsightsSyncing(false)
    }
  }

  const insightsAvailable = lastSync !== null

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
          label: syncing ? 'Cancelar sync' : 'Sincronizar Estrutura',
          icon: syncing ? XCircle : RefreshCw,
          onClick: syncing ? handleCancelSync : handleSyncClick,
        }}
      />

      {/* Fixed read-only mode notice */}
      <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
        <EyeOff className="h-4 w-4 text-pb-blue shrink-0" />
        <p className="text-sm text-pb-text">
          <span className="font-semibold">Modo leitura.</span> Nenhuma campanha será criada, editada ou publicada.
          Modo recomendado: estrutura sem insights.
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
        <div className="bg-pb-card border border-pb-border rounded-xl p-4 space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-pb-border font-semibold mb-3">Presets</p>
            <div className="flex flex-wrap gap-2">
              {SYNC_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  disabled={syncing}
                  onClick={() => applyPreset(preset.id)}
                  className={cn(
                    'text-left rounded-lg px-3 py-2 border transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                    selectedPreset === preset.id
                      ? 'border-pb-purple/60 bg-pb-purple/10'
                      : 'border-pb-border bg-pb-card-alt hover:border-pb-purple/30'
                  )}
                >
                  <span className="block text-sm font-semibold text-pb-text">
                    {preset.label}
                    {preset.needsConfirmation && <span className="ml-1.5 text-[10px] text-pb-yellow font-normal">(confirma)</span>}
                  </span>
                  <span className="block text-[11px] text-pb-muted mt-0.5">{preset.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-pb-border font-semibold mb-3">Escopo do sync</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className="text-xs text-pb-muted space-y-1 block">
                <span className="block">Status</span>
                <select
                  value={scope.status}
                  disabled={syncing}
                  onChange={e => updateScope({ status: e.target.value === 'all' ? 'all' : 'active' })}
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
                  onChange={e => updateScope({ campaignLimit: Number(e.target.value) })}
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
                  onChange={e => updateScope({ adLimit: Number(e.target.value) })}
                  className="w-full bg-pb-card-alt border border-pb-border rounded-lg px-2.5 py-1.5 text-sm text-pb-text disabled:opacity-50"
                >
                  {[50, 100, 250].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>

              <label className="text-xs text-pb-muted space-y-1 block">
                <span className="block">Nome da campanha contém</span>
                <input
                  type="text"
                  value={scope.nameContains ?? ''}
                  disabled={syncing}
                  onChange={e => updateScope({ nameContains: e.target.value })}
                  placeholder="Ex: FLEYN, FNL-V7, EE1K, TC"
                  className="w-full bg-pb-card-alt border border-pb-border rounded-lg px-2.5 py-1.5 text-sm text-pb-text placeholder:text-pb-muted/50 disabled:opacity-50"
                />
              </label>
            </div>
            <p className="text-[11px] text-pb-muted/70 mt-2">
              Este filtro busca no nome da campanha. Para filtrar anúncios por remessa/hook (ex: &quot;-R2-&quot;), use a busca em Dark Posts/Winners depois do sync.
            </p>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={forceRefreshCreatives}
              disabled={syncing}
              onChange={e => setForceRefreshCreatives(e.target.checked)}
              className="mt-0.5 accent-pb-purple"
            />
            <span>
              <span className="block text-sm text-pb-text">Forçar refresh de criativos</span>
              <span className="block text-xs text-pb-muted">Ignora o cache e busca todos os criativos de novo na Meta.</span>
            </span>
          </label>

          {plan && (
            <div className="rounded-lg px-3.5 py-3" style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              <div className="flex items-center gap-2">
                <Gauge className="h-3.5 w-3.5 text-pb-blue shrink-0" />
                <p className="text-xs text-pb-text font-medium">Plano estimado: ~{plan.estimatedRequests} chamadas à Meta</p>
              </div>
              {plan.warnings.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {plan.warnings.map(w => (
                    <li key={w} className="text-[11px] text-pb-yellow flex items-start gap-1.5">
                      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                      {w}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {showConfirm && (
            <div className="rounded-lg px-3.5 py-3 space-y-2.5" style={{ background: 'rgba(250, 204, 21, 0.08)', border: '1px solid rgba(250, 204, 21, 0.3)' }}>
              <p className="text-xs text-pb-text font-medium">
                Esse sync pode bater limite da Meta. Recomendado usar Structure Sync sem insights, com escopo menor.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void runSync()}
                  className="text-xs font-semibold text-white bg-pb-purple hover:bg-pb-purple/90 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Confirmar mesmo assim
                </button>
                <button
                  onClick={() => { applyPreset('seguro'); }}
                  className="text-xs font-medium text-pb-text border border-pb-border rounded-lg px-3 py-1.5 hover:bg-pb-card-alt transition-colors"
                >
                  Ajustar escopo (usar Seguro)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live sync progress */}
      {syncing && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(139, 92, 246, 0.06)', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
          <Loader2 className="h-4 w-4 text-pb-purple shrink-0 animate-spin" />
          <p className="text-sm text-pb-text">{STAGE_LABELS[syncPhase]}…</p>
          <span className={cn('text-xs ml-auto', stuckSeconds > 20 ? 'text-pb-yellow font-medium' : 'text-pb-muted')}>
            última atualização há {stuckSeconds}s
          </span>
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
                  <button
                    key={action}
                    onClick={() => handleErrorAction(action)}
                    className="text-xs text-pb-text border border-pb-border rounded-lg px-2.5 py-1 hover:bg-pb-card-alt transition-colors"
                  >
                    {action}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {emptyReason && !syncing && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(148, 163, 184, 0.06)', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
          <AlertTriangle className="h-4 w-4 text-pb-muted shrink-0" />
          <p className="text-sm text-pb-text">{emptyReason}</p>
        </div>
      )}

      {/* Contextual notes for expected-but-surprising outcomes (e.g. ads found but no creatives) —
          not errors, just explanations so a real absence of data doesn't read as a bug. */}
      {syncWarnings.length > 0 && !syncing && (
        <div className="rounded-xl px-4 py-3 space-y-1" style={{ background: 'rgba(148, 163, 184, 0.06)', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
          {syncWarnings.map(w => (
            <p key={w} className="text-sm text-pb-text flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-pb-muted shrink-0 mt-0.5" />
              {w}
            </p>
          ))}
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
                <p className="text-xs text-pb-muted mt-4">Nenhum sync realizado ainda. Clique em &quot;Sincronizar Estrutura&quot; para importar a estrutura da conta.</p>
              )}
            </>
          )
        })()}
      </div>

      {/* Debug do último sync — collapsible, client-side only, same visual pattern as "Como renovar token?" */}
      {(syncStartedAt || debugEvents.length > 0) && (
        <div className="rounded-xl border border-pb-border overflow-hidden">
          <button
            onClick={() => setShowDebugPanel(v => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-pb-card hover:bg-pb-card-alt transition-colors"
          >
            <span className="flex items-center gap-2 text-sm text-pb-text font-medium">
              <Gauge className="h-4 w-4 text-pb-purple" />
              Debug do último sync
            </span>
            <ChevronDown className={cn('h-4 w-4 text-pb-muted transition-transform', showDebugPanel && 'rotate-180')} />
          </button>
          {showDebugPanel && (
            <div className="px-4 py-4 space-y-3 text-xs text-pb-muted bg-pb-card-alt">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                <p><span className="text-pb-text font-medium">adAccountId:</span> {selectedAccountId || '—'}</p>
                <p><span className="text-pb-text font-medium">Etapa:</span> {STAGE_LABELS[syncPhase]}</p>
                <p><span className="text-pb-text font-medium">Início:</span> {syncStartedAt ? new Date(syncStartedAt).toLocaleTimeString('pt-BR') : '—'}</p>
                <p><span className="text-pb-text font-medium">Fim:</span> {syncFinishedAt ? new Date(syncFinishedAt).toLocaleTimeString('pt-BR') : '—'}</p>
                <p>
                  <span className="text-pb-text font-medium">Duração:</span>{' '}
                  {syncStartedAt ? `${Math.round(((syncFinishedAt ?? Date.now()) - syncStartedAt) / 1000)}s` : '—'}
                </p>
                <p><span className="text-pb-text font-medium">Status:</span> {syncing ? 'em andamento' : syncError ? 'erro' : 'concluído'}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-1">
                <p><span className="text-pb-text font-medium">Campanhas:</span> {syncCounts.campaigns}</p>
                <p><span className="text-pb-text font-medium">Conjuntos:</span> {syncCounts.adsets}</p>
                <p><span className="text-pb-text font-medium">Anúncios:</span> {syncCounts.ads}</p>
                <p><span className="text-pb-text font-medium">Criativos:</span> {syncCounts.creatives}</p>
                <p><span className="text-pb-text font-medium">Dark Posts:</span> {syncCounts.darkPosts}</p>
              </div>
              {syncError && <p><span className="text-pb-text font-medium">Erro:</span> {syncError.message}</p>}
              {syncWarnings.length > 0 && (
                <div>
                  <p className="text-pb-text font-medium mb-1">Avisos:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {syncWarnings.map(w => <li key={w}>{w}</li>)}
                  </ul>
                </div>
              )}
              {debugEvents.length > 0 && (
                <div>
                  <p className="text-pb-text font-medium mb-1">Últimos eventos:</p>
                  <ul className="space-y-0.5 font-mono">
                    {debugEvents.map((e, i) => (
                      <li key={i}>{e.time} — {e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Insights de Performance — fully separate flow, own state, own errors ── */}
      <div className="rounded-xl border border-pb-border overflow-hidden">
        <div className="px-4 py-3 bg-pb-card flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-pb-text flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-pb-purple" />
              Insights de Performance
            </p>
            <p className="text-xs text-pb-muted mt-1">
              Complementar — a performance principal do Pitbrain vem da UTMify. Escopo padrão: nível anúncio, últimos 7 dias, até 50 anúncios.
            </p>
          </div>
          <button
            onClick={handleInsightsSyncClick}
            disabled={!insightsAvailable || insightsSyncing}
            title={!insightsAvailable ? 'Rode um Structure Sync primeiro.' : undefined}
            className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-pb-purple hover:bg-pb-purple/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3.5 py-2 transition-colors shrink-0"
          >
            {insightsSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart2 className="h-4 w-4" />}
            Sincronizar Insights
          </button>
        </div>

        <div className="px-4 py-3 bg-pb-card-alt space-y-2">
          {!insightsAvailable && (
            <p className="text-xs text-pb-muted">Disponível depois de um Structure Sync concluído para esta conta.</p>
          )}
          <p className="text-[11px] text-pb-yellow flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
            Insights fazem mais chamadas e podem bater limite da Meta. Use apenas quando necessário.
          </p>

          {showInsightsConfirm && (
            <div className="rounded-lg px-3.5 py-3 space-y-2.5" style={{ background: 'rgba(250, 204, 21, 0.08)', border: '1px solid rgba(250, 204, 21, 0.3)' }}>
              <p className="text-xs text-pb-text font-medium">
                Confirma sincronizar Insights agora? Isso faz chamadas extras à Meta, separadas do Structure Sync.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleInsightsSyncClick}
                  className="text-xs font-semibold text-white bg-pb-purple hover:bg-pb-purple/90 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Confirmar Insights
                </button>
                <button
                  onClick={() => setShowInsightsConfirm(false)}
                  className="text-xs font-medium text-pb-text border border-pb-border rounded-lg px-3 py-1.5 hover:bg-pb-card-alt transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {insightsError && (
            <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <p className="text-xs text-pb-red">{insightsError}</p>
              <p className="text-[11px] text-pb-muted mt-1">Este erro não afeta o Structure Sync.</p>
            </div>
          )}

          {insightsResult && !insightsError && (
            <p className="text-xs text-pb-text">
              {insightsResult.length} {insightsResult.length === 1 ? 'insight' : 'insights'} carregados (últimos 7 dias).
            </p>
          )}
        </div>
      </div>
    </PageShell>
  )
}
