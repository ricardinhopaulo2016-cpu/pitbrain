'use client'

import { useState, useCallback, useEffect } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { AlertTriangle, CheckCircle2, Wifi, WifiOff, Loader2, EyeOff, Plug } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClassifiedMcpTool } from '@/lib/utmify-mcp/utmify-mcp-types'

type ConnectionState = 'checking' | 'not_configured' | 'connected' | 'error'

export default function UtmifySyncPage() {
  const [connection, setConnection] = useState<ConnectionState>('checking')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [tools, setTools] = useState<ClassifiedMcpTool[]>([])
  const [toolsError, setToolsError] = useState<string | null>(null)

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
          de leitura (get/list/search/fetch/relatórios) podem ser chamadas — o resto é bloqueado automaticamente.
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
              {tools.map(tool => (
                <div key={tool.name} className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-pb-text font-mono">{tool.name}</p>
                    {tool.description && <p className="text-xs text-pb-muted mt-0.5">{tool.description}</p>}
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md shrink-0',
                      tool.readOnly ? 'text-pb-green bg-pb-green/10' : 'text-pb-red bg-pb-red/10'
                    )}
                  >
                    {tool.readOnly ? 'read-only' : 'bloqueada'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </PageShell>
  )
}
