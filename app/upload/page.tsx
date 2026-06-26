'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { CsvDropzone } from '@/components/upload/CsvDropzone'
import { UploadStatusBadge } from '@/components/upload/UploadStatusBadge'
import { useUpload } from '@/hooks/useUpload'
import { COLUMN_LABELS } from '@/lib/parsers/normalizer'
import { AlertCircle, ArrowRight, Info, AlertTriangle, CheckCircle2, BarChart2 } from 'lucide-react'

const REQUIRED_FOR_DIAGNOSIS = new Set(['order_date', 'gross_revenue', 'status', 'utm_campaign'])

export default function UploadPage() {
  const [metaFile, setMetaFile] = useState<File | null>(null)
  const [utmifyFile, setUtmifyFile] = useState<File | null>(null)
  const { upload, status, result, error } = useUpload()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!metaFile && !utmifyFile) return
    await upload(metaFile, utmifyFile)
  }

  const missingCols = result?.utmifyMissingColumns ?? []
  const criticalMissing = missingCols.filter(c => REQUIRED_FOR_DIAGNOSIS.has(c))
  const optionalMissing = missingCols.filter(c => !REQUIRED_FOR_DIAGNOSIS.has(c))

  return (
    <PageShell className="max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-pb-text">Upload de Dados</h1>
        <p className="text-pb-muted text-sm mt-1">
          Importe o CSV do Meta Ads e/ou o relatório do UTMify. Pelo menos um arquivo é obrigatório.
        </p>
      </div>

      {/* Instrução */}
      <div className="bg-pb-blue/10 border border-pb-blue/30 rounded-xl p-4 flex gap-3">
        <Info className="h-4 w-4 text-pb-blue shrink-0 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="text-pb-text"><strong>Meta Ads:</strong> Gerenciador de Anúncios → Relatórios → Exportar CSV</p>
          <p className="text-pb-text"><strong>UTMify:</strong> Dashboard → Pedidos → Exportar</p>
        </div>
      </div>

      {/* Dropzones side-by-side */}
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
              label="CSV do UTMify"
              description="Relatório de pedidos com UTMs e conversões"
              onFileSelected={setUtmifyFile}
              selectedFile={utmifyFile}
            />
          </div>
        </div>

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

      {/* Success result */}
      {result && status === 'success' && (
        <div className="space-y-3">
          <div className="bg-pb-green/10 border border-pb-green/30 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-pb-green" />
              <p className="font-semibold text-pb-green text-sm">Importação concluída!</p>
            </div>
            <ul className="text-sm text-pb-muted space-y-1">
              {result.metaCount > 0 && <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-pb-blue" />{result.metaCount} linhas do Meta Ads importadas</li>}
              {result.utmifyCount > 0 && <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-pb-purple" />{result.utmifyCount} pedidos do UTMify importados</li>}
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

          {/* Critical missing columns */}
          {criticalMissing.length > 0 && (
            <div className="bg-pb-red/10 border border-pb-red/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-pb-red shrink-0" />
                <p className="font-semibold text-pb-red text-sm">Colunas obrigatórias não encontradas no CSV do UTMify</p>
              </div>
              <p className="text-xs text-pb-muted">
                Sem essas colunas, o diagnóstico não consegue calcular receita e conversões corretamente.
              </p>
              <ul className="space-y-1.5">
                {criticalMissing.map(col => (
                  <li key={col} className="flex items-center gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-pb-red shrink-0" />
                    <strong className="text-pb-text">{COLUMN_LABELS[col] ?? col}</strong>
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

          {/* Optional missing columns */}
          {optionalMissing.length > 0 && (
            <div className="bg-pb-yellow/10 border border-pb-yellow/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-pb-yellow shrink-0" />
                <p className="font-semibold text-pb-yellow text-sm">Colunas opcionais não encontradas</p>
              </div>
              <p className="text-xs text-pb-muted">
                Estas colunas enriquecem o diagnóstico mas não são obrigatórias. Os campos ficam como <em>null</em>.
              </p>
              <ul className="space-y-1.5">
                {optionalMissing.map(col => (
                  <li key={col} className="flex items-center gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-pb-yellow shrink-0" />
                    <strong className="text-pb-text">{COLUMN_LABELS[col] ?? col}</strong>
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
