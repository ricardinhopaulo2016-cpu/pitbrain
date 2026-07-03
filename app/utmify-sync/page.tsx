'use client'

import { useState, useCallback, useEffect } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  AlertTriangle, CheckCircle2, Wifi, WifiOff, Loader2, EyeOff, Plug,
  ChevronDown, Copy, Check, PlayCircle, ListChecks,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClassifiedMcpTool, ToolSafety } from '@/lib/utmify-mcp/utmify-mcp-types'

type ConnectionState = 'checking' | 'not_configured' | 'connected' | 'error'

const SAFETY_BADGE: Record<ToolSafety, { label: string; className: string }> = {
  read_only: { label: 'LEITURA', className: 'text-pb-green bg-pb-green/10' },
  blocked: { label: 'BLOQUEADA', className: 'text-pb-red bg-pb-red/10' },
  review_required: { label: 'REVISAR', className: 'text-pb-yellow bg-pb-yellow/10' },
  unknown: { label: 'DESCONHECIDA', className: 'text-pb-border bg-pb-card-alt' },
}

const SUGGESTED_FLOW = [
  { step: 1, tool: 'get_dashboards', goal: 'Listar dashboards disponíveis e pegar o dashboardId.' },
  { step: 2, tool: 'get_dashboard_summary', goal: 'Puxar métricas gerais do dashboard por período.' },
  { step: 3, tool: 'get_meta_ad_objects', goal: 'Puxar objetos de anúncios/campanhas/conjuntos/ads vinculados.' },
]

interface McpCallResponse {
  tool: string
  result?: unknown
  error?: string
}

/**
 * Best-effort extraction of a {id, name} list from a get_dashboards result — the real UTMify MCP
 * response shape isn't confirmed yet (no live UTMIFY_MCP_URL to test against in this session), so
 * this tries a few plausible shapes and falls back to nothing found. The raw JSON is always shown
 * in "Resposta MCP" alongside this, so nothing is hidden if the guess is wrong.
 */
function extractDashboardsBestEffort(result: unknown): { id: string; name: string }[] {
  function fromArray(arr: unknown): { id: string; name: string }[] {
    if (!Array.isArray(arr)) return []
    const out: { id: string; name: string }[] = []
    for (const item of arr) {
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>
        const id = obj.id ?? obj.dashboardId ?? obj.dashboard_id
        if (id !== undefined && id !== null) {
          const name = obj.name ?? obj.title ?? obj.label
          out.push({ id: String(id), name: name ? String(name) : String(id) })
        }
      }
    }
    return out
  }

  if (!result || typeof result !== 'object') return []
  const obj = result as Record<string, unknown>

  if (Array.isArray(obj.structuredContent)) return fromArray(obj.structuredContent)
  if (obj.structuredContent && typeof obj.structuredContent === 'object') {
    const sc = obj.structuredContent as Record<string, unknown>
    if (Array.isArray(sc.dashboards)) return fromArray(sc.dashboards)
  }
  if (Array.isArray(obj.content)) {
    for (const item of obj.content) {
      if (item && typeof item === 'object' && (item as Record<string, unknown>).type === 'text') {
        const text = (item as Record<string, unknown>).text
        if (typeof text === 'string') {
          try {
            const parsed = JSON.parse(text)
            if (Array.isArray(parsed)) return fromArray(parsed)
            if (parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).dashboards)) {
              return fromArray((parsed as Record<string, unknown>).dashboards)
            }
          } catch {
            // not JSON — ignore, raw JSON panel still shows the text as-is
          }
        }
      }
    }
  }
  return []
}

export default function UtmifySyncPage() {
  const [connection, setConnection] = useState<ConnectionState>('checking')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [tools, setTools] = useState<ClassifiedMcpTool[]>([])
  const [toolsError, setToolsError] = useState<string | null>(null)
  const [expandedSchemaFor, setExpandedSchemaFor] = useState<string | null>(null)
  const [testingTool, setTestingTool] = useState<string | null>(null)

  const [lastResponse, setLastResponse] = useState<McpCallResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const [guidedRunning, setGuidedRunning] = useState(false)
  const [guidedError, setGuidedError] = useState<string | null>(null)
  const [dashboards, setDashboards] = useState<{ id: string; name: string }[] | null>(null)
  const [selectedDashboardId, setSelectedDashboardId] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const checkStatus = useCallback(async () => {
    setConnection('checking')
    setConnectionError(null)
    try {
      const res = await fetch('/api/utmify-mcp/status')
      const json = await res.json()
      if (!json.configured) {
        setConnection('not_configured')
        return
      }
      if (!json.connected) {
        setConnection('error')
        setConnectionError(json.error ?? 'Erro ao conectar com o MCP UTMify.')
        return
      }
      setConnection('connected')
    } catch (err) {
      setConnection('error')
      setConnectionError(err instanceof Error ? err.message : 'Erro ao conectar com o MCP UTMify.')
    }
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  useEffect(() => {
    if (connection !== 'connected') return
    setToolsError(null)
    fetch('/api/utmify-mcp/tools')
      .then(res => res.json())
      .then(json => setTools(json.tools ?? []))
      .catch(err => setToolsError(err instanceof Error ? err.message : 'Erro ao listar ferramentas.'))
  }, [connection])

  async function handleTestConnection() {
    if (testing) return
    setTesting(true)
    await checkStatus()
    setTesting(false)
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

  async function handleRunGuidedDiagnostic() {
    setGuidedRunning(true)
    setGuidedError(null)
    setDashboards(null)
    setSelectedDashboardId(null)
    try {
      const result = await callMcpTool('get_dashboards')
      setLastResponse({ tool: 'get_dashboards', result })
      setDashboards(extractDashboardsBestEffort(result))
    } catch (err) {
      setGuidedError(err instanceof Error ? err.message : 'Erro ao buscar dashboards.')
    } finally {
      setGuidedRunning(false)
    }
  }

  async function handleFetchSummary() {
    if (!selectedDashboardId) return
    setSummaryLoading(true)
    setGuidedError(null)
    try {
      const result = await callMcpTool('get_dashboard_summary', { dashboardId: selectedDashboardId })
      setLastResponse({ tool: 'get_dashboard_summary', result })
    } catch (err) {
      setGuidedError(err instanceof Error ? err.message : 'Erro ao buscar resumo do dashboard.')
    } finally {
      setSummaryLoading(false)
    }
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="UTMify Sync"
        chips={[
          {
            label: connection === 'connected' ? 'Conectado'
              : connection === 'not_configured' ? 'Não configurado'
              : connection === 'error' ? 'Erro de conexão'
              : 'Verificando',
            icon: connection === 'connected' ? Wifi : WifiOff,
          },
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

      {/* Manual connection check */}
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

      {connection === 'connected' && (
        <div className="flex items-center gap-2 rounded-xl px-4 py-4 bg-pb-card border border-pb-border">
          <CheckCircle2 className="h-4 w-4 text-pb-green shrink-0" />
          <span className="text-sm text-pb-text font-medium">MCP UTMify conectado.</span>
        </div>
      )}

      {connection === 'connected' && (
        <>
          {/* Fluxo sugerido */}
          <div className="bg-pb-card border border-pb-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(42,42,64,0.6)' }}>
              <ListChecks className="h-4 w-4 text-pb-purple" />
              <p className="text-sm font-semibold text-pb-text">Fluxo sugerido</p>
            </div>
            <div className="px-4 py-3 space-y-2.5">
              {SUGGESTED_FLOW.map(s => (
                <div key={s.step} className="flex items-start gap-3">
                  <span className="text-xs font-bold text-pb-purple bg-pb-purple/10 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                    {s.step}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm text-pb-text font-mono">{s.tool}</p>
                    <p className="text-xs text-pb-muted">{s.goal}</p>
                  </div>
                </div>
              ))}
              <button
                onClick={handleRunGuidedDiagnostic}
                disabled={guidedRunning}
                className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-white bg-pb-purple hover:bg-pb-purple/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3.5 py-2 transition-colors"
              >
                {guidedRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                Executar diagnóstico MCP básico
              </button>

              {guidedError && <p className="text-xs text-pb-red">{guidedError}</p>}

              {dashboards && (
                <div className="space-y-2 pt-1">
                  {dashboards.length === 0 ? (
                    <p className="text-xs text-pb-muted">
                      get_dashboards respondeu, mas não consegui reconhecer o formato automaticamente — veja o
                      JSON bruto em &quot;Resposta MCP&quot; abaixo.
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-pb-muted">Selecione um dashboard:</p>
                      <select
                        value={selectedDashboardId ?? ''}
                        onChange={e => setSelectedDashboardId(e.target.value || null)}
                        className="w-full bg-pb-card-alt border border-pb-border rounded-lg px-2.5 py-1.5 text-sm text-pb-text"
                      >
                        <option value="">Selecione…</option>
                        {dashboards.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={handleFetchSummary}
                        disabled={!selectedDashboardId || summaryLoading}
                        className="inline-flex items-center gap-2 text-xs font-medium text-pb-text border border-pb-border rounded-lg px-3 py-1.5 hover:bg-pb-card-alt transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {summaryLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Buscar resumo
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Resposta MCP */}
          {lastResponse && (
            <div className="bg-pb-card border border-pb-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(42,42,64,0.6)' }}>
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
              <pre className="px-4 py-3 text-[11px] text-pb-muted font-mono overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap break-all">
                {JSON.stringify(lastResponse.error ?? lastResponse.result, null, 2)}
              </pre>
            </div>
          )}

          {/* Ferramentas disponíveis */}
          <div className="bg-pb-card border border-pb-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(42,42,64,0.6)' }}>
              <Plug className="h-4 w-4 text-pb-purple" />
              <p className="text-sm font-semibold text-pb-text">Ferramentas disponíveis</p>
              <span className="text-xs text-pb-muted ml-auto">{tools.length}</span>
            </div>
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
        </>
      )}
    </PageShell>
  )
}
