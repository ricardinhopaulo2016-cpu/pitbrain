'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { UtmRankingTable } from '@/components/dashboard/UtmRankingTable'
import {
  AlertTriangle, CheckCircle2, Wifi, WifiOff, Loader2, EyeOff, Plug,
  ChevronDown, Copy, Check, ListChecks, Database, Download, Save,
  BarChart2, GitFork, Brain,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClassifiedMcpTool, ToolSafety } from '@/lib/utmify-mcp/utmify-mcp-types'
import type { UtmifyDashboardOption, UtmifyMcpLevel, UtmifyMcpPlatform } from '@/lib/utmify-mcp/utmify-mcp-normalizers'
import { createPitbrainImportFromUtmifyMcp } from '@/lib/utmify-mcp/utmify-mcp-import'
import type { PitbrainImportSummary } from '@/types/pitbrain'
import type { UtmifyDailyRow, UtmifyBreakdownRow } from '@/types/utmify'

// 'dashboards_failed': the transport/URL/token work at the protocol level (tools/list succeeded),
// but the get_dashboards smoke test failed — most commonly MCP_INTEGRATION_NOT_FOUND from a stale
// UTMIFY_MCP_URL. Distinct from 'error' (couldn't even reach/list tools) so the UI can point at the
// right fix.
type ConnectionState = 'checking' | 'not_configured' | 'connected' | 'dashboards_failed' | 'error'

const SAFETY_BADGE: Record<ToolSafety, { label: string; className: string }> = {
  read_only: { label: 'LEITURA', className: 'text-pb-green bg-pb-green/10' },
  blocked: { label: 'BLOQUEADA', className: 'text-pb-red bg-pb-red/10' },
  review_required: { label: 'REVISAR', className: 'text-pb-yellow bg-pb-yellow/10' },
  unknown: { label: 'DESCONHECIDA', className: 'text-pb-border bg-pb-card-alt' },
}

type PeriodPreset = 'today' | 'yesterday' | '7d' | '30d' | 'this_month' | 'last_month' | 'custom'

const PERIOD_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'this_month', label: 'Mês atual' },
  { value: 'last_month', label: 'Mês anterior' },
  { value: 'custom', label: 'Personalizado' },
]

type ReportType = 'summary' | UtmifyMcpPlatform

const REPORT_TYPE_OPTIONS: { value: ReportType; label: string }[] = [
  { value: 'summary', label: 'Resumo geral' },
  { value: 'meta', label: 'Meta Ads' },
  { value: 'google', label: 'Google Ads' },
  { value: 'kwai', label: 'Kwai Ads' },
  { value: 'tiktok', label: 'TikTok Ads' },
]

const LEVEL_OPTIONS: { value: UtmifyMcpLevel; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'account', label: 'Account' },
  { value: 'campaign', label: 'Campaign' },
  { value: 'adset', label: 'Adset' },
  { value: 'ad', label: 'Ad' },
]

interface Period { label: string; start: string; end: string }

function pad2(n: number): string { return String(n).padStart(2, '0') }
function toIsoDate(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }

/** Pure — computes {label, start, end} for a period preset using the current date. Not a Workflow
 * script, so plain `new Date()` is fine here. */
function resolvePeriod(preset: PeriodPreset, customStart: string, customEnd: string): Period {
  const now = new Date()
  const today = toIsoDate(now)
  switch (preset) {
    case 'today':
      return { label: 'Hoje', start: today, end: today }
    case 'yesterday': {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      const s = toIsoDate(y)
      return { label: 'Ontem', start: s, end: s }
    }
    case '7d': {
      const s = new Date(now)
      s.setDate(s.getDate() - 6)
      return { label: 'Últimos 7 dias', start: toIsoDate(s), end: today }
    }
    case '30d': {
      const s = new Date(now)
      s.setDate(s.getDate() - 29)
      return { label: 'Últimos 30 dias', start: toIsoDate(s), end: today }
    }
    case 'this_month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1)
      return { label: 'Mês atual', start: toIsoDate(s), end: today }
    }
    case 'last_month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const e = new Date(now.getFullYear(), now.getMonth(), 0)
      return { label: 'Mês anterior', start: toIsoDate(s), end: toIsoDate(e) }
    }
    case 'custom':
      return {
        label: customStart && customEnd ? `${customStart} → ${customEnd}` : 'Personalizado',
        start: customStart,
        end: customEnd,
      }
  }
}

function fC(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}
function fN(v: number): string {
  return new Intl.NumberFormat('pt-BR').format(Math.round(v))
}
function fX(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(2)}x`
}
function fP(v: number | null): string {
  return v === null ? '—' : `${v.toFixed(2)}%`
}
function fCn(v: number | null): string {
  return v === null ? '—' : fC(v)
}

interface McpCallResponse {
  tool: string
  result?: unknown
  error?: string
}

interface SummaryPullResult {
  summary: PitbrainImportSummary
  row: UtmifyDailyRow
  recognized: boolean
  raw: unknown
}

interface RowsPullResult {
  rows: UtmifyBreakdownRow[]
  recognized: boolean
  raw: unknown
}

export default function UtmifySyncPage() {
  const router = useRouter()

  const [connection, setConnection] = useState<ConnectionState>('checking')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [urlConfigured, setUrlConfigured] = useState<boolean | null>(null)
  const [testing, setTesting] = useState(false)

  // ── Step B: dashboard ──
  const [dashboards, setDashboards] = useState<UtmifyDashboardOption[] | null>(null)
  const [dashboardsLoading, setDashboardsLoading] = useState(false)
  const [dashboardsError, setDashboardsError] = useState<string | null>(null)
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null)

  // ── Step C/D/E: period, report type, level ──
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('7d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [reportType, setReportType] = useState<ReportType>('summary')
  const [level, setLevel] = useState<UtmifyMcpLevel>('campaign')

  // ── Step F/G: pull + preview ──
  const [pulling, setPulling] = useState(false)
  const [pullError, setPullError] = useState<string | null>(null)
  const [summaryResult, setSummaryResult] = useState<SummaryPullResult | null>(null)
  const [rowsResult, setRowsResult] = useState<RowsPullResult | null>(null)
  const [showRawJson, setShowRawJson] = useState(false)

  // ── Step H: save ──
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedImportId, setSavedImportId] = useState<string | null>(null)

  // ── Advanced / MCP tools accordion ──
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [tools, setTools] = useState<ClassifiedMcpTool[]>([])
  const [toolsError, setToolsError] = useState<string | null>(null)
  const [expandedSchemaFor, setExpandedSchemaFor] = useState<string | null>(null)
  const [testingTool, setTestingTool] = useState<string | null>(null)
  const [lastResponse, setLastResponse] = useState<McpCallResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const checkStatus = useCallback(async () => {
    setConnection('checking')
    setConnectionError(null)
    try {
      const res = await fetch('/api/utmify-mcp/status')
      const json = await res.json()
      setUrlConfigured(Boolean(json.configured))
      if (!json.configured) {
        setConnection('not_configured')
        return
      }
      if (!json.connected) {
        setConnection('error')
        setConnectionError(json.error ?? 'Erro ao conectar com o MCP UTMify.')
        return
      }
      if (!json.dashboardsOk) {
        setConnection('dashboards_failed')
        setConnectionError(json.error ?? 'get_dashboards não respondeu como esperado.')
        return
      }
      setConnection('connected')
    } catch (err) {
      setUrlConfigured(false)
      setConnection('error')
      setConnectionError(err instanceof Error ? err.message : 'Erro ao conectar com o MCP UTMify.')
    }
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  useEffect(() => {
    if (!advancedOpen) return
    setToolsError(null)
    fetch('/api/utmify-mcp/tools')
      .then(res => res.json())
      .then(json => setTools(json.tools ?? []))
      .catch(err => setToolsError(err instanceof Error ? err.message : 'Erro ao listar ferramentas.'))
  }, [advancedOpen])

  async function handleTestConnection() {
    if (testing) return
    setTesting(true)
    await checkStatus()
    setTesting(false)
  }

  const canUseWizard = connection === 'connected' || connection === 'dashboards_failed'

  async function handleFetchDashboards() {
    if (dashboardsLoading) return
    setDashboardsLoading(true)
    setDashboardsError(null)
    try {
      const res = await fetch('/api/utmify-mcp/dashboards')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao buscar dashboards.')
      setDashboards(json.dashboards ?? [])
    } catch (err) {
      setDashboardsError(err instanceof Error ? err.message : 'Erro ao buscar dashboards.')
    } finally {
      setDashboardsLoading(false)
    }
  }

  const selectedDashboard = dashboards?.find(d => d.id === selectedDashboardId) ?? null

  async function handlePull() {
    if (!selectedDashboardId || !selectedDashboard) {
      setPullError('Selecione um dashboard UTMify antes de puxar dados.')
      return
    }
    if (reportType !== 'summary' && !LEVEL_OPTIONS.some(l => l.value === level)) {
      setPullError('Selecione um nível válido: All, Account, Campaign, Adset ou Ad.')
      return
    }

    setPulling(true)
    setPullError(null)
    setSavedImportId(null)
    setSaveError(null)
    const period = resolvePeriod(periodPreset, customStart, customEnd)

    // Step 1: summary — never calls ad-objects before this succeeds (item 15/56).
    try {
      const res = await fetch('/api/utmify-mcp/dashboard-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboardId: selectedDashboardId, period }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao buscar resumo do dashboard.')
      setSummaryResult({ summary: json.summary, row: json.row, recognized: json.recognized, raw: json.raw })
    } catch (err) {
      // Dashboard stays selected — user can just try again (item 56).
      setPullError(err instanceof Error ? err.message : 'Erro ao buscar resumo do dashboard.')
      setSummaryResult(null)
      setRowsResult(null)
      setPulling(false)
      return
    }

    if (reportType === 'summary') {
      setRowsResult(null)
      setPulling(false)
      return
    }

    // Step 2: breakdown — only reached once summary above already succeeded (item 16).
    try {
      const res = await fetch('/api/utmify-mcp/ad-objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dashboardId: selectedDashboardId, platform: reportType, level, period }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao buscar objetos de anúncios.')
      setRowsResult({ rows: json.rows, recognized: json.recognized, raw: json.raw })
    } catch (err) {
      // summaryResult from step 1 stays intact — still importável mesmo que o breakdown falhe (item 57).
      setPullError(err instanceof Error ? err.message : 'Erro ao buscar objetos de anúncios.')
      setRowsResult(null)
    } finally {
      setPulling(false)
    }
  }

  async function handleSave() {
    if (!summaryResult || !selectedDashboard) return
    setSaving(true)
    setSaveError(null)
    try {
      const period = resolvePeriod(periodPreset, customStart, customEnd)
      const imp = await createPitbrainImportFromUtmifyMcp({
        dashboard: selectedDashboard,
        period,
        summary: summaryResult.summary,
        summaryRow: summaryResult.row,
        rows: rowsResult?.rows,
        platform: reportType !== 'summary' ? reportType : undefined,
        level: reportType !== 'summary' ? level : undefined,
      })
      setSavedImportId(imp.id)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar import.')
    } finally {
      setSaving(false)
    }
  }

  async function callMcpTool(tool: string, args?: Record<string, unknown>): Promise<unknown> {
    const res = await fetch('/api/utmify-mcp/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, arguments: args ?? {} }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Erro ao chamar a ferramenta MCP.')
    return json.result
  }

  async function handleTestTool(name: string) {
    if (testingTool) return
    setTestingTool(name)
    setLastResponse(null)
    try {
      const result = await callMcpTool(name)
      setLastResponse({ tool: name, result })
    } catch (err) {
      setLastResponse({ tool: name, error: err instanceof Error ? err.message : 'Erro ao chamar a ferramenta.' })
    } finally {
      setTestingTool(null)
    }
  }

  function handleCopyJson() {
    if (!lastResponse) return
    const text = JSON.stringify(lastResponse.error ?? lastResponse.result, null, 2)
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="UTMify Sync"
        chips={[
          {
            label: connection === 'connected' ? 'Conectado'
              : connection === 'dashboards_failed' ? 'Integração não reconhecida'
              : connection === 'not_configured' ? 'Não configurado'
              : connection === 'error' ? 'Erro de conexão'
              : 'Verificando',
            icon: connection === 'connected' ? Wifi : WifiOff,
          },
          ...(urlConfigured !== null ? [{ label: `URL configurada: ${urlConfigured ? 'sim' : 'não'}` }] : []),
        ]}
      />

      {/* Fixed read-only mode notice */}
      <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
        <EyeOff className="h-4 w-4 text-pb-blue shrink-0" />
        <p className="text-sm text-pb-text">
          <span className="font-semibold">Modo leitura.</span> Nenhum dado será alterado na UTMify. Só ferramentas
          classificadas como LEITURA podem ser chamadas — o resto (bloqueadas, a revisar, desconhecidas) é
          recusado automaticamente, mesmo via API.
        </p>
      </div>

      {/* Step 1: connection status */}
      <div>
        <button
          onClick={handleTestConnection}
          disabled={testing || connection === 'checking'}
          className="inline-flex items-center gap-2 text-sm font-medium text-pb-text bg-pb-card border border-pb-border rounded-lg px-3.5 py-2 hover:bg-pb-card-alt transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin text-pb-purple" /> : <Wifi className="h-4 w-4 text-pb-purple" />}
          Testar conexão
        </button>
      </div>

      {connection === 'not_configured' && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-4" style={{ background: 'rgba(250, 204, 21, 0.06)', border: '1px solid rgba(250, 204, 21, 0.25)' }}>
          <AlertTriangle className="h-4 w-4 text-pb-yellow shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-pb-text">Configure UTMIFY_MCP_URL nas variáveis de ambiente.</p>
            <p className="text-xs text-pb-muted mt-1">
              Local: adicione em <span className="font-mono">.env.local</span> e reinicie <span className="font-mono">npm run dev</span>.
              Vercel: Project Settings → Environment Variables → <span className="font-mono">UTMIFY_MCP_URL</span> e faça Redeploy.
            </p>
          </div>
        </div>
      )}

      {connection === 'error' && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-4" style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
          <AlertTriangle className="h-4 w-4 text-pb-red shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-pb-text">Erro ao conectar com o MCP UTMify</p>
            <p className="text-xs text-pb-muted mt-1">{connectionError}</p>
          </div>
        </div>
      )}

      {connection === 'dashboards_failed' && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-4" style={{ background: 'rgba(250, 204, 21, 0.06)', border: '1px solid rgba(250, 204, 21, 0.25)' }}>
          <AlertTriangle className="h-4 w-4 text-pb-yellow shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-pb-text">Integração MCP da UTMify não encontrada</p>
            <p className="text-xs text-pb-muted mt-1">{connectionError}</p>
          </div>
        </div>
      )}

      {connection === 'connected' && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-4 bg-pb-card border border-pb-border">
          <CheckCircle2 className="h-4 w-4 text-pb-green shrink-0" />
          <span className="text-sm text-pb-text font-medium">MCP UTMify conectado.</span>
        </div>
      )}

      {canUseWizard && (
        <>
          {/* Step 2: dashboard selection */}
          <div className="bg-pb-card border border-pb-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(42,42,64,0.6)' }}>
              <Database className="h-4 w-4 text-pb-purple" />
              <p className="text-sm font-semibold text-pb-text">1. Dashboard</p>
            </div>
            <div className="px-4 py-3 space-y-2.5">
              <button
                onClick={handleFetchDashboards}
                disabled={dashboardsLoading}
                className="inline-flex items-center gap-2 text-sm font-medium text-pb-text border border-pb-border rounded-lg px-3.5 py-2 hover:bg-pb-card-alt transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {dashboardsLoading ? <Loader2 className="h-4 w-4 animate-spin text-pb-purple" /> : <Download className="h-4 w-4 text-pb-purple" />}
                Buscar dashboards
              </button>

              {dashboardsError && <p className="text-xs text-pb-red">{dashboardsError}</p>}

              {dashboards && dashboards.length === 0 && !dashboardsError && (
                <p className="text-xs text-pb-muted">
                  Nenhum dashboard reconhecido automaticamente — veja o JSON bruto após puxar dados.
                </p>
              )}

              {dashboards && dashboards.length > 0 && (
                <select
                  value={selectedDashboardId ?? ''}
                  onChange={e => setSelectedDashboardId(e.target.value || null)}
                  className="w-full bg-pb-card-alt border border-pb-border rounded-lg px-2.5 py-1.5 text-sm text-pb-text"
                >
                  <option value="">Selecione um dashboard…</option>
                  {dashboards.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.id})</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Step 3-5: period, report type, level */}
          <div className="bg-pb-card border border-pb-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(42,42,64,0.6)' }}>
              <ListChecks className="h-4 w-4 text-pb-purple" />
              <p className="text-sm font-semibold text-pb-text">2. Período, relatório e nível</p>
            </div>
            <div className="px-4 py-3 space-y-3">
              <div>
                <label className="text-xs text-pb-muted mb-1 block">Período</label>
                <select
                  value={periodPreset}
                  onChange={e => setPeriodPreset(e.target.value as PeriodPreset)}
                  className="w-full bg-pb-card-alt border border-pb-border rounded-lg px-2.5 py-1.5 text-sm text-pb-text"
                >
                  {PERIOD_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                {periodPreset === 'custom' && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="date"
                      value={customStart}
                      onChange={e => setCustomStart(e.target.value)}
                      className="flex-1 bg-pb-card-alt border border-pb-border rounded-lg px-2.5 py-1.5 text-sm text-pb-text"
                    />
                    <span className="text-pb-muted text-xs">→</span>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={e => setCustomEnd(e.target.value)}
                      className="flex-1 bg-pb-card-alt border border-pb-border rounded-lg px-2.5 py-1.5 text-sm text-pb-text"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-pb-muted mb-1 block">Tipo de relatório</label>
                <select
                  value={reportType}
                  onChange={e => setReportType(e.target.value as ReportType)}
                  className="w-full bg-pb-card-alt border border-pb-border rounded-lg px-2.5 py-1.5 text-sm text-pb-text"
                >
                  {REPORT_TYPE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              {reportType !== 'summary' && (
                <div>
                  <label className="text-xs text-pb-muted mb-1 block">Nível</label>
                  <select
                    value={level}
                    onChange={e => setLevel(e.target.value as UtmifyMcpLevel)}
                    className="w-full bg-pb-card-alt border border-pb-border rounded-lg px-2.5 py-1.5 text-sm text-pb-text"
                  >
                    {LEVEL_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              )}

              <button
                onClick={handlePull}
                disabled={pulling}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-pb-purple hover:bg-pb-purple/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3.5 py-2 transition-colors"
              >
                {pulling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Puxar dados da UTMify
              </button>

              {pullError && <p className="text-xs text-pb-red">{pullError}</p>}
            </div>
          </div>

          {/* Step G: preview */}
          {summaryResult && (
            <div className="bg-pb-card border border-pb-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(42,42,64,0.6)' }}>
                <BarChart2 className="h-4 w-4 text-pb-purple" />
                <p className="text-sm font-semibold text-pb-text">3. Preview</p>
              </div>
              <div className="px-4 py-4 space-y-4">
                {!summaryResult.recognized && (
                  <div className="flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ background: 'rgba(250, 204, 21, 0.06)', border: '1px solid rgba(250, 204, 21, 0.2)' }}>
                    <AlertTriangle className="h-3.5 w-3.5 text-pb-yellow shrink-0 mt-0.5" />
                    <p className="text-xs text-pb-muted">
                      Não foi possível reconhecer automaticamente o formato retornado pela UTMify. Os números
                      abaixo podem estar incompletos — confira o JSON bruto.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricCard title="Gasto" value={fC(summaryResult.summary.spend)} />
                  <MetricCard title="Faturamento" value={fC(summaryResult.summary.revenue)} />
                  <MetricCard title="Lucro" value={fC(summaryResult.summary.profit)} />
                  <MetricCard title="ROAS" value={fX(summaryResult.summary.roas)} />
                  <MetricCard title="ROI" value={fP(summaryResult.summary.roi)} />
                  <MetricCard title="Vendas" value={fN(summaryResult.summary.sales)} />
                  <MetricCard title="IC / Add To Cart" value={fN(summaryResult.summary.ic)} />
                  <MetricCard title="CPA" value={fCn(summaryResult.summary.cpa)} />
                  <MetricCard title="CPC" value={fCn(summaryResult.summary.cpc)} />
                  <MetricCard title="CPM" value={fCn(summaryResult.summary.cpm)} />
                  <MetricCard title="CTR" value={fP(summaryResult.summary.ctr)} />
                  <MetricCard title="Cliques" value={fN(summaryResult.summary.clicks)} />
                </div>

                {rowsResult && rowsResult.rows.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-pb-muted uppercase tracking-wide mb-2">
                      Ranking — {reportType} · {level}
                    </p>
                    <UtmRankingTable rows={rowsResult.rows} dimensionLabel="Objeto de anúncio" />
                  </div>
                )}
                {reportType !== 'summary' && !rowsResult && !pulling && (
                  <p className="text-xs text-pb-muted">
                    Este import não possui breakdown ainda — clique em &quot;Puxar dados da UTMify&quot; novamente
                    ou verifique o erro acima.
                  </p>
                )}

                <div>
                  <button
                    onClick={() => setShowRawJson(v => !v)}
                    className="inline-flex items-center gap-1 text-[11px] text-pb-muted hover:text-pb-text transition-colors"
                  >
                    <ChevronDown className={cn('h-3 w-3 transition-transform', showRawJson && 'rotate-180')} />
                    Ver detalhes técnicos
                  </button>
                  {showRawJson && (
                    <pre className="mt-1.5 text-[10px] text-pb-muted font-mono bg-pb-card-alt rounded-lg p-2.5 overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap break-all">
                      {JSON.stringify({ summary: summaryResult.raw, adObjects: rowsResult?.raw }, null, 2)}
                    </pre>
                  )}
                </div>

                <div className="pt-1 border-t border-pb-border/40 space-y-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-pb-purple hover:bg-pb-purple/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3.5 py-2 transition-colors"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar import no Pitbrain
                  </button>
                  {saveError && <p className="text-xs text-pb-red">{saveError}</p>}

                  {savedImportId && (
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-pb-green shrink-0" />
                      <span className="text-xs text-pb-text">Import salvo.</span>
                      <button
                        onClick={() => router.push('/dashboard')}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-pb-text border border-pb-border rounded-lg px-2.5 py-1.5 hover:bg-pb-card-alt transition-colors"
                      >
                        <BarChart2 className="h-3 w-3" />
                        Carregar na Dashboard
                      </button>
                      <button
                        onClick={() => router.push('/imports')}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-pb-text border border-pb-border rounded-lg px-2.5 py-1.5 hover:bg-pb-card-alt transition-colors"
                      >
                        <GitFork className="h-3 w-3" />
                        Ver em Imports
                      </button>
                      <button
                        onClick={() => router.push('/diagnostico')}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-pb-text border border-pb-border rounded-lg px-2.5 py-1.5 hover:bg-pb-card-alt transition-colors"
                      >
                        <Brain className="h-3 w-3" />
                        Gerar Diagnóstico
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Advanced / raw MCP tools accordion */}
          <div className="bg-pb-card border border-pb-border rounded-xl overflow-hidden">
            <button
              onClick={() => setAdvancedOpen(v => !v)}
              className="w-full px-4 py-3 flex items-center gap-2 hover:bg-pb-card-alt transition-colors"
            >
              <Plug className="h-4 w-4 text-pb-purple" />
              <p className="text-sm font-semibold text-pb-text">Avançado / Ferramentas MCP</p>
              <ChevronDown className={cn('h-4 w-4 text-pb-muted ml-auto transition-transform', advancedOpen && 'rotate-180')} />
            </button>

            {advancedOpen && (
              <div style={{ borderTop: '1px solid rgba(42,42,64,0.6)' }}>
                {lastResponse && (
                  <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(42,42,64,0.4)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm font-semibold text-pb-text">Resposta MCP</p>
                      <span className="text-xs text-pb-muted font-mono">{lastResponse.tool}</span>
                      <button
                        onClick={handleCopyJson}
                        className="ml-auto inline-flex items-center gap-1.5 text-xs text-pb-text border border-pb-border rounded-lg px-2.5 py-1 hover:bg-pb-card-alt transition-colors"
                      >
                        {copied ? <Check className="h-3 w-3 text-pb-green" /> : <Copy className="h-3 w-3" />}
                        {copied ? 'Copiado!' : 'Copiar JSON'}
                      </button>
                    </div>
                    <pre className="text-[11px] text-pb-muted font-mono overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(lastResponse.error ?? lastResponse.result, null, 2)}
                    </pre>
                  </div>
                )}

                {toolsError && <p className="px-4 py-3 text-xs text-pb-red">{toolsError}</p>}
                {!toolsError && tools.length === 0 && (
                  <p className="px-4 py-3 text-xs text-pb-muted">Nenhuma ferramenta reportada pelo servidor.</p>
                )}
                {tools.length > 0 && (
                  <div className="divide-y" style={{ borderColor: 'rgba(42,42,64,0.4)' }}>
                    {tools.map(tool => {
                      const badge = SAFETY_BADGE[tool.safety]
                      const callable = tool.safety === 'read_only'
                      const schemaOpen = expandedSchemaFor === tool.name
                      return (
                        <div key={tool.name} className="px-4 py-3 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm text-pb-text font-mono">{tool.name}</p>
                                <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md shrink-0', badge.className)}>
                                  {badge.label}
                                </span>
                                {tool.safety === 'read_only' && !tool.reviewed && (
                                  <span className="text-[10px] text-pb-muted">Leitura — não revisada</span>
                                )}
                              </div>
                              {tool.description && (
                                <p className="text-xs text-pb-muted mt-1 line-clamp-2">{tool.description}</p>
                              )}
                            </div>
                            <button
                              onClick={() => handleTestTool(tool.name)}
                              disabled={!callable || testingTool === tool.name}
                              title={!callable ? `Ferramenta ${badge.label.toLowerCase()} — não pode ser chamada.` : undefined}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-pb-purple hover:bg-pb-purple/90 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-3 py-1.5 transition-colors shrink-0"
                            >
                              {testingTool === tool.name ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                              Testar tool
                            </button>
                          </div>

                          {tool.inputSchema && (
                            <div>
                              <button
                                onClick={() => setExpandedSchemaFor(schemaOpen ? null : tool.name)}
                                className="inline-flex items-center gap-1 text-[11px] text-pb-muted hover:text-pb-text transition-colors"
                              >
                                <ChevronDown className={cn('h-3 w-3 transition-transform', schemaOpen && 'rotate-180')} />
                                Ver detalhes técnicos
                              </button>
                              {schemaOpen && (
                                <pre className="mt-1.5 text-[10px] text-pb-muted font-mono bg-pb-card-alt rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-all">
                                  {JSON.stringify(tool.inputSchema, null, 2)}
                                </pre>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </PageShell>
  )
}
