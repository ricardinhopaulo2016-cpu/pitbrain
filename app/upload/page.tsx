'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { CsvDropzone } from '@/components/upload/CsvDropzone'
import { useUpload } from '@/hooks/useUpload'
import { checkSupabaseHealth } from '@/lib/storage/pitbrain-storage'
import { generateUtmifyPreview, FilePreviewData } from '@/lib/parsers/file-preview'
import { DAILY_COLUMN_LABELS } from '@/lib/parsers/normalizer'
import {
  AlertCircle, ArrowRight, Info, AlertTriangle, CheckCircle2,
  Loader2, Eye, Tag, Rows3, BarChart2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const TYPE_LABELS: Record<string, string> = {
  utmify_orders:       'UTMify — Pedidos/Vendas',
  utmify_daily:        'UTMify — Relatório Agregado Diário',
  utmify_utm_breakdown:'UTMify — Quebra por UTM',
  unknown:             'Tipo desconhecido',
}

function PreviewPanel({ preview }: { preview: FilePreviewData }) {
  return (
    <div className="border border-pb-border rounded-xl overflow-hidden text-sm">
      <div className="bg-pb-card-alt px-4 py-3 flex items-center gap-2 border-b border-pb-border">
        <Eye className="h-4 w-4 text-pb-purple" />
        <span className="font-semibold text-pb-text">Preview</span>
        <span className="text-pb-muted text-xs truncate">{preview.fileName}</span>
      </div>

      {preview.error ? (
        <div className="p-4 flex items-start gap-2 text-pb-red">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="text-sm">{preview.error}</p>
        </div>
      ) : (
        <div className="divide-y divide-pb-border">
          {/* Type + row count */}
          <div className="px-4 py-3 flex flex-wrap gap-x-6 gap-y-1">
            <div className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-pb-muted" />
              <span className="text-pb-muted text-xs">Tipo:</span>
              <span className="text-pb-text text-xs font-medium">{TYPE_LABELS[preview.detectedType] ?? preview.detectedType}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Rows3 className="h-3.5 w-3.5 text-pb-muted" />
              <span className="text-pb-muted text-xs">Linhas:</span>
              <span className="text-pb-text text-xs font-medium">{preview.rowCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-pb-muted text-xs">Colunas:</span>
              <span className="text-pb-text text-xs font-medium">
                {preview.allColumns.length} encontradas · {preview.recognizedColumns.length} reconhecidas
              </span>
            </div>
          </div>

          {/* UTM Breakdown info */}
          {preview.detectedType === 'utmify_utm_breakdown' && (
            <div className="px-4 py-3">
              <p className="text-xs text-pb-muted">
                Arquivo de <span className="text-pb-text font-medium">Quebra por UTM</span> — data não é obrigatória neste tipo de relatório.
              </p>
            </div>
          )}

          {/* Recognized columns */}
          {preview.recognizedColumns.length > 0 && (
            <div className="px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-pb-muted uppercase tracking-wide">Colunas reconhecidas</p>
              <div className="flex flex-wrap gap-1.5">
                {preview.recognizedColumns.map(c => (
                  <span key={c.canonical} className="inline-flex items-center gap-1 bg-pb-green/10 text-pb-green border border-pb-green/20 rounded px-2 py-0.5 text-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    {c.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Missing columns */}
          {preview.missingColumns.length > 0 && (
            <div className="px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-pb-muted uppercase tracking-wide">Colunas faltando</p>
              <div className="flex flex-wrap gap-1.5">
                {preview.missingColumns.map(c => (
                  <span
                    key={c.canonical}
                    className={`inline-flex items-center gap-1 border rounded px-2 py-0.5 text-xs ${
                      c.required
                        ? 'bg-pb-red/10 text-pb-red border-pb-red/20'
                        : 'bg-pb-yellow/10 text-pb-yellow border-pb-yellow/20'
                    }`}
                  >
                    {c.required ? <AlertCircle className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {c.label}
                    {c.required && <span className="opacity-70">(obrigatória)</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Preview rows */}
          {preview.previewRows.length > 0 && (
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-pb-muted uppercase tracking-wide">
                Primeiras {preview.previewRows.length} linhas
              </p>
              <div className="overflow-x-auto rounded border border-pb-border">
                <table className="text-xs w-full min-w-max">
                  <thead>
                    <tr className="bg-pb-card-alt border-b border-pb-border">
                      {Object.keys(preview.previewRows[0]).map(col => (
                        <th key={col} className="px-3 py-2 text-left font-medium text-pb-muted whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.previewRows.map((row, i) => (
                      <tr key={i} className="border-b border-pb-border last:border-0 hover:bg-pb-card-alt/50">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-3 py-2 text-pb-text whitespace-nowrap max-w-[200px] truncate">{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function UploadPage() {
  const [utmifyFile, setUtmifyFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<FilePreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  const { upload, forceUpload, status, result, error, reset: resetUpload, duplicateSession, storageMode } = useUpload()
  const [schemaReady, setSchemaReady] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (storageMode !== 'supabase') return
    checkSupabaseHealth().then(h => setSchemaReady(h.tablesReady))
  }, [storageMode])

  // Generate preview when file changes
  useEffect(() => {
    if (!utmifyFile) { setPreview(null); return }
    setPreviewLoading(true)
    generateUtmifyPreview(utmifyFile)
      .then(setPreview)
      .finally(() => setPreviewLoading(false))
  }, [utmifyFile])

  // Redirect to /imports after successful upload
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => router.push('/imports'), 1200)
      return () => clearTimeout(timer)
    }
  }, [status, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await upload(utmifyFile)
  }

  return (
    <PageShell className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-pb-text">Upload UTMify</h1>
        <p className="text-pb-muted text-sm mt-1">
          Importe seu relatório da UTMify para análise. Cada upload vira um import salvo.
        </p>
      </div>

      {/* Info box — Meta Ads future */}
      <div className="bg-pb-blue/[0.07] border border-pb-blue/20 rounded-xl p-4 flex gap-3">
        <Info className="h-4 w-4 text-pb-blue shrink-0 mt-0.5" />
        <p className="text-xs text-pb-muted leading-relaxed">
          <span className="text-pb-text font-medium">Meta Ads Structure</span> ficará disponível futuramente em <span className="text-pb-text font-medium">Pit Planilhas</span>.
          No momento, o Pitbrain está focado em relatórios UTMify (CSV, XLSX ou XLS).
        </p>
      </div>

      {/* Local mode notice — Supabase not configured */}
      {storageMode === 'local' && (
        <div className="bg-pb-purple/[0.07] border border-pb-purple/20 rounded-xl p-4 flex gap-3">
          <Info className="h-4 w-4 text-pb-purple shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs text-pb-text font-medium">
              Modo local ativo — este import será salvo apenas neste navegador.
            </p>
            <p className="text-[11px] text-pb-muted">
              Supabase não configurado. Persistência compartilhada desativada.
            </p>
          </div>
        </div>
      )}

      {/* Supabase configured but schema not installed yet */}
      {storageMode === 'supabase' && schemaReady === false && (
        <div className="bg-pb-yellow/[0.07] border border-pb-yellow/20 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="h-4 w-4 text-pb-yellow shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs text-pb-text font-medium">
              Supabase conectado, mas schema não instalado.
            </p>
            <p className="text-[11px] text-pb-muted">
              Rode supabase/schema.sql no SQL Editor do Supabase. Até lá, este import será salvo apenas neste navegador.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Dropzone */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-pb-purple" />
            <p className="text-xs font-semibold text-pb-muted uppercase tracking-wide">UTMify</p>
          </div>
          <CsvDropzone
            label="Arquivo UTMify"
            description="Relatório de pedidos, relatório agregado diário ou quebra por UTM"
            accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            acceptHint="Arraste um .csv, .xlsx ou .xls ou clique para selecionar"
            onFileSelected={setUtmifyFile}
            selectedFile={utmifyFile}
          />
        </div>

        {/* Preview loading */}
        {previewLoading && (
          <div className="flex items-center gap-2 text-pb-muted text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analisando arquivo…
          </div>
        )}

        {preview && !previewLoading && <PreviewPanel preview={preview} />}

        {/* Duplicate warning */}
        {status === 'duplicate' && duplicateSession && (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.25)' }}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-pb-yellow shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-pb-yellow">Este arquivo parece já ter sido importado.</p>
                <p className="text-xs text-pb-muted mt-1">
                  Importação anterior: <strong className="text-pb-text">{duplicateSession.fileName}</strong>
                  {' '}· {duplicateSession.rowCount} linhas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 pl-7">
              <button
                type="button"
                onClick={() => forceUpload(utmifyFile)}
                className="inline-flex items-center gap-2 bg-pb-yellow/15 hover:bg-pb-yellow/25 text-pb-yellow font-medium px-4 py-2 rounded-lg text-xs transition-colors border border-pb-yellow/30"
              >
                Importar mesmo assim
              </button>
              <button
                type="button"
                onClick={resetUpload}
                className="inline-flex items-center gap-2 border border-pb-border text-pb-muted hover:text-pb-text font-medium px-4 py-2 rounded-lg text-xs transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-pb-red/10 border border-pb-red/30 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="h-4 w-4 text-pb-red shrink-0" />
            <p className="text-pb-red text-sm">{error}</p>
          </div>
        )}

        {/* Success */}
        {status === 'success' && result && (
          <div className="bg-pb-green/10 border border-pb-green/30 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-pb-green shrink-0" />
            <div>
              <p className="font-semibold text-pb-green text-sm">Import salvo!</p>
              <p className="text-xs text-pb-muted mt-0.5">Redirecionando para Imports Salvos…</p>
            </div>
          </div>
        )}

        {/* Submit */}
        {status !== 'duplicate' && status !== 'success' && (
          <div className="flex items-center justify-end pt-1">
            <button
              type="submit"
              disabled={!utmifyFile || status === 'uploading'}
              className="inline-flex items-center gap-2 bg-pb-purple hover:bg-pb-purple/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition-all text-sm"
            >
              {status === 'uploading'
                ? <><Loader2 className="h-4 w-4 animate-spin" />Processando…</>
                : <><BarChart2 className="h-4 w-4" />Salvar import<ArrowRight className="h-4 w-4" /></>
              }
            </button>
          </div>
        )}
      </form>
    </PageShell>
  )
}
