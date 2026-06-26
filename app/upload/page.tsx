'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { CsvDropzone } from '@/components/upload/CsvDropzone'
import { UploadStatusBadge } from '@/components/upload/UploadStatusBadge'
import { useUpload } from '@/hooks/useUpload'
import { COLUMN_LABELS, DAILY_COLUMN_LABELS } from '@/lib/parsers/normalizer'
import {
  generateMetaPreview,
  generateUtmifyPreview,
  FilePreviewData,
} from '@/lib/parsers/file-preview'
import {
  AlertCircle,
  ArrowRight,
  Info,
  AlertTriangle,
  CheckCircle2,
  BarChart2,
  Loader2,
  Eye,
  Tag,
  Rows3,
} from 'lucide-react'

const REQUIRED_FOR_DIAGNOSIS = new Set(['order_date', 'gross_revenue', 'status', 'utm_campaign'])

const TYPE_LABELS: Record<string, string> = {
  meta_ads: 'Meta Ads CSV',
  utmify_orders: 'UTMify — Pedidos/Vendas',
  utmify_daily: 'UTMify — Relatório Agregado Diário',
  unknown: 'Tipo desconhecido',
}

function PreviewPanel({
  preview,
  accentClass,
}: {
  preview: FilePreviewData
  accentClass: string
}) {
  const hasCriticalMissing = preview.missingColumns.some(c => c.required)

  return (
    <div className="border border-pb-border rounded-xl overflow-hidden text-sm">
      {/* Header */}
      <div className="bg-pb-card-alt px-4 py-3 flex items-center gap-2 border-b border-pb-border">
        <Eye className={`h-4 w-4 ${accentClass}`} />
        <span className="font-semibold text-pb-text">Preview</span>
        <span className="text-pb-muted truncate">{preview.fileName}</span>
      </div>

      {preview.error ? (
        <div className="p-4 flex items-start gap-2 text-pb-red">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{preview.error}</p>
        </div>
      ) : (
        <div className="divide-y divide-pb-border">
          {/* Summary */}
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
                    {c.required
                      ? <AlertCircle className="h-3 w-3" />
                      : <AlertTriangle className="h-3 w-3" />
                    }
                    {c.label}
                    {c.required && <span className="opacity-70">(obrigatória)</span>}
                  </span>
                ))}
              </div>
              {hasCriticalMissing && (
                <p className="text-xs text-pb-muted">
                  Colunas obrigatórias ausentes afetam o diagnóstico, mas você pode continuar.
                </p>
              )}
            </div>
          )}

          {/* First 5 rows */}
          {preview.previewRows.length > 0 && (
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs font-semibold text-pb-muted uppercase tracking-wide">
                Primeiras {preview.previewRows.length} linhas normalizadas
              </p>
              <div className="overflow-x-auto rounded border border-pb-border">
                <table className="text-xs w-full min-w-max">
                  <thead>
                    <tr className="bg-pb-card-alt border-b border-pb-border">
                      {Object.keys(preview.previewRows[0]).map(col => (
                        <th key={col} className="px-3 py-2 text-left font-medium text-pb-muted whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.previewRows.map((row, i) => (
                      <tr key={i} className="border-b border-pb-border last:border-0 hover:bg-pb-card-alt/50">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-3 py-2 text-pb-text whitespace-nowrap max-w-[200px] truncate">
                            {val}
                          </td>
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
  const [metaFile, setMetaFile] = useState<File | null>(null)
  const [utmifyFile, setUtmifyFile] = useState<File | null>(null)
  const [metaPreview, setMetaPreview] = useState<FilePreviewData | null>(null)
  const [utmifyPreview, setUtmifyPreview] = useState<FilePreviewData | null>(null)
  const [metaPreviewLoading, setMetaPreviewLoading] = useState(false)
  const [utmifyPreviewLoading, setUtmifyPreviewLoading] = useState(false)

  const { upload, status, result, error } = useUpload()
  const router = useRouter()

  useEffect(() => {
    if (!metaFile) { setMetaPreview(null); return }
    setMetaPreviewLoading(true)
    generateMetaPreview(metaFile)
      .then(setMetaPreview)
      .finally(() => setMetaPreviewLoading(false))
  }, [metaFile])

  useEffect(() => {
    if (!utmifyFile) { setUtmifyPreview(null); return }
    setUtmifyPreviewLoading(true)
    generateUtmifyPreview(utmifyFile)
      .then(setUtmifyPreview)
      .finally(() => setUtmifyPreviewLoading(false))
  }, [utmifyFile])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!metaFile && !utmifyFile) return
    await upload(metaFile, utmifyFile)
  }

  const missingCols = result?.utmifyMissingColumns ?? []
  const criticalMissing = missingCols.filter(c => REQUIRED_FOR_DIAGNOSIS.has(c))
  const optionalMissing = missingCols.filter(c => !REQUIRED_FOR_DIAGNOSIS.has(c))
  const allLabels = { ...COLUMN_LABELS, ...DAILY_COLUMN_LABELS }

  return (
    <PageShell className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-pb-text">Upload de Dados</h1>
        <p className="text-pb-muted text-sm mt-1">
          Importe o CSV do Meta Ads e/ou o relatório da UTMify. Pelo menos um arquivo é obrigatório.
        </p>
      </div>

      {/* Instruções */}
      <div className="bg-pb-blue/10 border border-pb-blue/30 rounded-xl p-4 flex gap-3">
        <Info className="h-4 w-4 text-pb-blue shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="text-pb-text">
            <strong>Meta Ads:</strong> Gerenciador de Anúncios → Relatórios → Exportar CSV
          </p>
          <p className="text-pb-text">
            <strong>UTMify:</strong> Dashboard → Pedidos/Relatórios → Exportar CSV ou XLSX
          </p>
        </div>
      </div>

      {/* Dropzones + Previews */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-pb-blue" />
              <p className="text-xs font-semibold text-pb-muted uppercase tracking-wide">Meta Ads</p>
            </div>
            <CsvDropzone
              label="CSV do Meta Ads"
              description="Exportação do Gerenciador de Anúncios (nível campanha, conjunto ou anúncio)"
              accept=".csv,text/csv"
              onFileSelected={setMetaFile}
              selectedFile={metaFile}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-pb-purple" />
              <p className="text-xs font-semibold text-pb-muted uppercase tracking-wide">UTMify</p>
            </div>
            <CsvDropzone
              label="CSV/XLSX da UTMify"
              description="Relatório de pedidos ou relatório agregado diário"
              accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              acceptHint="Arraste um .csv, .xlsx ou .xls ou clique para selecionar"
              onFileSelected={setUtmifyFile}
              selectedFile={utmifyFile}
            />
          </div>
        </div>

        {/* Preview loading indicator */}
        {(metaPreviewLoading || utmifyPreviewLoading) && (
          <div className="flex items-center gap-2 text-pb-muted text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analisando arquivo…
          </div>
        )}

        {/* Meta preview */}
        {metaPreview && !metaPreviewLoading && (
          <PreviewPanel preview={metaPreview} accentClass="text-pb-blue" />
        )}

        {/* UTMify preview */}
        {utmifyPreview && !utmifyPreviewLoading && (
          <PreviewPanel preview={utmifyPreview} accentClass="text-pb-purple" />
        )}

        <div className="flex items-center justify-between pt-2">
          <UploadStatusBadge status={status} />
          <button
            type="submit"
            disabled={(!metaFile && !utmifyFile) || status === 'uploading'}
            className="inline-flex items-center gap-2 bg-pb-purple hover:bg-pb-purple/90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition-all text-sm"
          >
            {status === 'uploading' ? 'Processando...' : 'Importar dados'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="bg-pb-red/10 border border-pb-red/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-pb-red shrink-0" />
          <p className="text-pb-red text-sm">{error}</p>
        </div>
      )}

      {/* Success */}
      {result && status === 'success' && (
        <div className="space-y-3">
          <div className="bg-pb-green/10 border border-pb-green/30 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-pb-green" />
              <p className="font-semibold text-pb-green text-sm">Importação concluída!</p>
            </div>
            <ul className="text-sm text-pb-muted space-y-1">
              {result.metaCount > 0 && (
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-pb-blue" />
                  {result.metaCount} linhas do Meta Ads importadas
                </li>
              )}
              {result.utmifyCount > 0 && (
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-pb-purple" />
                  {result.utmifyCount}{' '}
                  {result.utmifySourceType === 'utmify_daily_aggregate' ? 'dias' : 'pedidos'} da UTMify importados
                  {result.utmifySourceType && (
                    <span className="text-xs text-pb-muted/70">
                      ({result.utmifySourceType === 'utmify_daily_aggregate' ? 'relatório agregado' : 'pedidos individuais'})
                    </span>
                  )}
                </li>
              )}
            </ul>
            {result.warnings.length > 0 && (
              <div className="text-xs text-pb-yellow space-y-0.5">
                {result.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
              </div>
            )}
            {missingCols.length === 0 && (
              <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center gap-2 bg-pb-green/20 hover:bg-pb-green/30 text-pb-green font-medium px-4 py-2 rounded-lg text-sm transition-colors border border-pb-green/30"
              >
                <BarChart2 className="h-4 w-4" />
                Ver dashboard
              </button>
            )}
          </div>

          {criticalMissing.length > 0 && (
            <div className="bg-pb-red/10 border border-pb-red/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-pb-red shrink-0" />
                <p className="font-semibold text-pb-red text-sm">Colunas obrigatórias não encontradas</p>
              </div>
              <p className="text-xs text-pb-muted">
                Sem essas colunas, o diagnóstico não consegue calcular receita e conversões corretamente.
              </p>
              <ul className="space-y-1.5">
                {criticalMissing.map(col => (
                  <li key={col} className="flex items-center gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-pb-red shrink-0" />
                    <strong className="text-pb-text">{allLabels[col] ?? col}</strong>
                    <code className="text-pb-muted">({col})</code>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex items-center gap-2 border border-pb-border text-pb-muted hover:text-pb-text font-medium px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Continuar mesmo assim
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {optionalMissing.length > 0 && (
            <div className="bg-pb-yellow/10 border border-pb-yellow/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-pb-yellow shrink-0" />
                <p className="font-semibold text-pb-yellow text-sm">Colunas opcionais não encontradas</p>
              </div>
              <ul className="space-y-1.5">
                {optionalMissing.map(col => (
                  <li key={col} className="flex items-center gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-pb-yellow shrink-0" />
                    <strong className="text-pb-text">{allLabels[col] ?? col}</strong>
                    <code className="text-pb-muted">({col})</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {missingCols.length > 0 && criticalMissing.length === 0 && (
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center gap-2 bg-pb-green/20 hover:bg-pb-green/30 text-pb-green font-medium px-4 py-2 rounded-lg text-sm transition-colors border border-pb-green/30"
            >
              Continuar para o dashboard
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </PageShell>
  )
}
