'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { loadImports as loadLocalImports, pitbrainImportToLastImport } from '@/lib/storage/imports'
import {
  listImports,
  saveImport,
  deleteImport,
  updateImport,
  getActiveImportId,
  setActiveImportId,
  getStorageMode,
} from '@/lib/storage/pitbrain-storage'
import { saveCurrentDataset } from '@/lib/calculators/local-metrics'
import { useSessionStore } from '@/store/sessionStore'
import type { PitbrainImport } from '@/types/pitbrain'
import {
  Database, Trash2, Edit3, BarChart2, CheckCircle2,
  Upload, Calendar, Layers, AlertCircle, X, AlertTriangle, CloudUpload, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function fmtNum(v: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

function fmtRoas(v: number | null) {
  if (v === null || isNaN(v)) return '—'
  return `${v.toFixed(2)}x`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function sourceLabel(imp: PitbrainImport) {
  if (imp.sourceType === 'utmify_utm_breakdown') {
    return `UTM Breakdown · ${imp.dimensionLabel ?? imp.dimensionField ?? ''}`
  }
  return 'UTMify · Agregado Diário'
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-wide text-pb-border font-semibold">{label}</span>
      <span className="text-xs font-semibold text-pb-text mt-0.5">{value}</span>
    </div>
  )
}

function RenameModal({ name, onSave, onCancel }: { name: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [val, setVal] = useState(name)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-pb-card border border-pb-border rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-pb-text text-sm">Renomear import</p>
          <button onClick={onCancel}><X className="h-4 w-4 text-pb-muted" /></button>
        </div>
        <input
          autoFocus
          className="w-full bg-pb-card-alt border border-pb-border rounded-lg px-3 py-2 text-sm text-pb-text focus:outline-none focus:border-pb-purple/60"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(val.trim()) }}
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-pb-border text-pb-muted text-sm hover:text-pb-text transition-colors">Cancelar</button>
          <button onClick={() => onSave(val.trim())} className="px-4 py-2 rounded-lg bg-pb-purple text-white text-sm font-medium hover:bg-pb-purple/90 transition-colors">Salvar</button>
        </div>
      </div>
    </div>
  )
}

function ImportCard({
  imp,
  isActive,
  onLoad,
  onDelete,
  onRename,
}: {
  imp: PitbrainImport
  isActive: boolean
  onLoad: () => void
  onDelete: () => void
  onRename: (name: string) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [delConfirm, setDelConfirm] = useState(false)
  const router = useRouter()

  const roasColor = imp.summary.roas === null ? 'text-pb-muted'
    : imp.summary.roas >= 2   ? 'text-pb-green'
    : imp.summary.roas >= 1   ? 'text-pb-yellow'
    : 'text-pb-red'

  // "Vendas/Pedidos" imports saved before the Page Views alias fix could have
  // been silently zeroed out (UTMify's "VIS. DE PÁG." header wasn't recognized).
  // Daily/breakdown imports already matched that header correctly, so this only
  // needs to flag the orders format.
  const mayBeMissingPageViews = imp.sourceType === 'utmify_orders' && imp.summary.pageViews === 0

  return (
    <>
      {renaming && (
        <RenameModal
          name={imp.name}
          onSave={name => { onRename(name); setRenaming(false) }}
          onCancel={() => setRenaming(false)}
        />
      )}

      <div className={cn(
        'bg-pb-card border rounded-xl overflow-hidden transition-all',
        isActive ? 'border-pb-purple/50' : 'border-pb-border hover:border-pb-border/80'
      )} style={isActive ? { boxShadow: '0 0 0 1px rgba(124,58,237,0.18)' } : undefined}>

        {/* Active badge */}
        {isActive && (
          <div className="flex items-center gap-1.5 px-4 py-1.5 bg-pb-purple/10 border-b border-pb-purple/20">
            <CheckCircle2 className="h-3 w-3 text-pb-purple" />
            <span className="text-[10px] font-semibold text-pb-purple uppercase tracking-wide">Import ativo — carregado no Dashboard</span>
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-pb-text text-sm truncate">{imp.name}</p>
              <p className="text-[10px] text-pb-muted mt-0.5 truncate">{imp.originalFileName}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
                <span className="text-[10px] text-pb-muted flex items-center gap-1">
                  <Database className="h-2.5 w-2.5" />
                  {sourceLabel(imp)}
                </span>
                {imp.periodLabel && (
                  <span className="text-[10px] text-pb-muted flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5" />
                    {imp.periodLabel}
                  </span>
                )}
                <span className="text-[10px] text-pb-muted">
                  {fmtDate(imp.createdAt)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setRenaming(true)}
                className="p-1.5 rounded-lg border border-pb-border text-pb-muted hover:text-pb-text hover:border-pb-border/80 transition-colors"
                title="Renomear"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              {!delConfirm ? (
                <button
                  onClick={() => setDelConfirm(true)}
                  className="p-1.5 rounded-lg border border-pb-border text-pb-muted hover:text-pb-red hover:border-pb-red/30 transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={onDelete}
                    className="px-2 py-1 rounded-lg bg-pb-red/15 border border-pb-red/30 text-pb-red text-[10px] font-semibold hover:bg-pb-red/25 transition-colors"
                  >
                    Excluir
                  </button>
                  <button
                    onClick={() => setDelConfirm(false)}
                    className="px-2 py-1 rounded-lg border border-pb-border text-pb-muted text-[10px] hover:text-pb-text transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Metrics strip */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <div className="bg-pb-card-alt rounded-lg px-3 py-2">
              <p className="text-[9px] text-pb-muted uppercase tracking-wide">Gasto</p>
              <p className="text-sm font-semibold text-pb-text mt-0.5">{fmtCurrency(imp.summary.spend)}</p>
            </div>
            <div className="bg-pb-card-alt rounded-lg px-3 py-2">
              <p className="text-[9px] text-pb-muted uppercase tracking-wide">Faturamento</p>
              <p className="text-sm font-semibold text-pb-text mt-0.5">{fmtCurrency(imp.summary.revenue)}</p>
            </div>
            <div className="bg-pb-card-alt rounded-lg px-3 py-2">
              <p className="text-[9px] text-pb-muted uppercase tracking-wide">Lucro</p>
              <p className="text-sm font-semibold text-pb-green mt-0.5">{fmtCurrency(imp.summary.profit)}</p>
            </div>
            <div className="bg-pb-card-alt rounded-lg px-3 py-2">
              <p className="text-[9px] text-pb-muted uppercase tracking-wide">ROAS</p>
              <p className={cn('text-sm font-semibold mt-0.5', roasColor)}>{fmtRoas(imp.summary.roas)}</p>
            </div>
            <div className="bg-pb-card-alt rounded-lg px-3 py-2">
              <p className="text-[9px] text-pb-muted uppercase tracking-wide">Vendas</p>
              <p className="text-sm font-semibold text-pb-text mt-0.5">{fmtNum(imp.summary.sales)}</p>
            </div>
            <div className="bg-pb-card-alt rounded-lg px-3 py-2">
              <p className="text-[9px] text-pb-muted uppercase tracking-wide">Linhas</p>
              <p className="text-sm font-semibold text-pb-text mt-0.5">{fmtNum(imp.rowCount)}</p>
            </div>
          </div>

          {/* Page Views reprocessing warning */}
          {mayBeMissingPageViews && (
            <div className="flex items-start gap-2 rounded-lg px-3 py-2 bg-pb-yellow/[0.06] border border-pb-yellow/20">
              <AlertTriangle className="h-3.5 w-3.5 text-pb-yellow shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-pb-muted leading-relaxed">
                  Este import pode ter sido salvo antes da correção de Page Views. Reimporte o arquivo para recalcular.
                </p>
              </div>
              <button
                onClick={() => router.push('/upload')}
                className="shrink-0 text-[11px] font-semibold text-pb-yellow hover:text-pb-yellow/80 transition-colors"
              >
                Reimportar
              </button>
            </div>
          )}

          {/* Footer: load button */}
          {!isActive && (
            <button
              onClick={onLoad}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-pb-purple/10 border border-pb-purple/25 text-pb-purple font-semibold text-sm hover:bg-pb-purple/20 transition-colors"
            >
              <BarChart2 className="h-4 w-4" />
              Carregar na Dashboard
            </button>
          )}
        </div>
      </div>
    </>
  )
}

export default function ImportsPage() {
  const [imports, setImports] = useState<PitbrainImport[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [localImportsCount, setLocalImportsCount] = useState(0)
  const [migrating, setMigrating] = useState(false)
  const [migrationDone, setMigrationDone] = useState<number | null>(null)
  const { reset: resetSession, setSessionId } = useSessionStore()
  const router = useRouter()
  const storageMode = getStorageMode()

  const refresh = useCallback(async () => {
    const [imps, id] = await Promise.all([listImports(), getActiveImportId()])
    setImports(imps)
    setActiveId(id)
    setLoaded(true)
    if (storageMode === 'supabase') {
      setLocalImportsCount(loadLocalImports().length)
    }
  }, [storageMode])

  useEffect(() => { refresh() }, [refresh])

  async function handleLoad(imp: PitbrainImport) {
    const lastImport = pitbrainImportToLastImport(imp)
    saveCurrentDataset(lastImport)
    await setActiveImportId(imp.id)
    setActiveId(imp.id)
    resetSession()
    setSessionId(`local:${imp.id}`)
    router.push('/dashboard')
  }

  async function handleDelete(id: string) {
    await deleteImport(id)
    refresh()
  }

  async function handleRename(id: string, name: string) {
    if (!name) return
    await updateImport(id, { name })
    refresh()
  }

  async function handleClearActive() {
    await setActiveImportId(null)
    setActiveId(null)
    resetSession()
  }

  async function handleMigrate() {
    setMigrating(true)
    const localImports = loadLocalImports()
    let migrated = 0
    for (const imp of localImports) {
      const { storageMode: savedMode } = await saveImport(imp)
      if (savedMode === 'supabase') migrated++
    }
    setMigrating(false)
    setMigrationDone(migrated)
    await refresh()
  }

  const hasActive = !!activeId && imports.some(i => i.id === activeId)

  return (
    <PageShell className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-pb-text">Imports Salvos</h1>
          <p className="text-pb-muted text-sm mt-0.5">
            {!loaded
              ? 'Carregando...'
              : imports.length === 0
              ? 'Nenhum import salvo ainda.'
              : `${imports.length} import${imports.length !== 1 ? 's' : ''} · clique em "Carregar na Dashboard" para ativar`
            }
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasActive && (
            <button
              onClick={handleClearActive}
              className="inline-flex items-center gap-2 border border-pb-border text-pb-muted hover:text-pb-red hover:border-pb-red/30 px-4 py-2 rounded-xl text-sm transition-all"
            >
              <X className="h-4 w-4" />
              Limpar ativo
            </button>
          )}
          <button
            onClick={() => router.push('/upload')}
            className="inline-flex items-center gap-2 bg-pb-purple hover:bg-pb-purple/90 text-white font-medium px-4 py-2 rounded-xl text-sm transition-all"
          >
            <Upload className="h-4 w-4" />
            Novo import
          </button>
        </div>
      </div>

      {/* Storage mode banner */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3',
          storageMode === 'supabase'
            ? 'bg-pb-green/[0.06] border border-pb-green/20'
            : 'bg-pb-purple/[0.06] border border-pb-purple/20'
        )}
      >
        <div className="flex items-center gap-2">
          <Database className={cn('h-3.5 w-3.5', storageMode === 'supabase' ? 'text-pb-green' : 'text-pb-purple')} />
          <span className="text-xs text-pb-text font-medium">
            {storageMode === 'supabase'
              ? 'Supabase ativo — dados compartilhados no banco.'
              : 'Modo local — dados apenas neste navegador.'}
          </span>
        </div>

        {storageMode === 'supabase' && localImportsCount > 0 && (
          migrationDone === null ? (
            <button
              onClick={handleMigrate}
              disabled={migrating}
              className="inline-flex items-center gap-2 bg-pb-green/15 hover:bg-pb-green/25 disabled:opacity-50 text-pb-green font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors border border-pb-green/30"
            >
              {migrating
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Migrando…</>
                : <><CloudUpload className="h-3.5 w-3.5" />Migrar {localImportsCount} import{localImportsCount !== 1 ? 's' : ''} local{localImportsCount !== 1 ? 'is' : ''} para Supabase</>
              }
            </button>
          ) : (
            <span className="text-[11px] text-pb-green font-medium">
              Imports locais migrados para Supabase. ({migrationDone})
            </span>
          )
        )}
      </div>

      {/* Empty state */}
      {imports.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
          <div className="w-20 h-20 rounded-2xl bg-pb-card border border-pb-border flex items-center justify-center">
            <Layers className="h-9 w-9 text-pb-muted" />
          </div>
          <div>
            <p className="text-pb-text font-medium mb-1">Nenhum import salvo</p>
            <p className="text-pb-muted text-sm max-w-xs leading-relaxed">
              Faça o upload de um relatório UTMify para começar.
            </p>
          </div>
          <button
            onClick={() => router.push('/upload')}
            className="inline-flex items-center gap-2 bg-pb-purple hover:bg-pb-purple/90 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition-all"
          >
            <Upload className="h-4 w-4" />
            Ir para Upload
          </button>
        </div>
      )}

      {/* Import cards */}
      <div className="space-y-4">
        {imports.map(imp => (
          <ImportCard
            key={imp.id}
            imp={imp}
            isActive={imp.id === activeId}
            onLoad={() => handleLoad(imp)}
            onDelete={() => handleDelete(imp.id)}
            onRename={name => handleRename(imp.id, name)}
          />
        ))}
      </div>
    </PageShell>
  )
}
