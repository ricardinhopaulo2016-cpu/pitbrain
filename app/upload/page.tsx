'use client'

// Upload por arquivo (CSV/XLSX) foi desativado do fluxo principal — UTMify MCP é a fonte oficial
// agora (ver /utmify-sync). O parser antigo (components/upload/CsvDropzone.tsx, hooks/useUpload.ts,
// lib/parsers/*) continua no repositório como código legado, só não é mais usado por esta página —
// não foi removido, só desligado da experiência do usuário, como pedido.

import { useRouter } from 'next/navigation'
import { PageShell } from '@/components/layout/PageShell'
import { Plug, ArrowRight } from 'lucide-react'

export default function UploadPage() {
  const router = useRouter()

  return (
    <PageShell className="space-y-4">
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#10101D', border: '1px solid #2A2A40' }}>
          <Plug className="h-7 w-7 text-pb-muted" />
        </div>
        <div>
          <p className="text-pb-text font-semibold mb-1">Importação por arquivo foi desativada</p>
          <p className="text-pb-muted text-sm max-w-sm">
            Use UTMify Sync — o Pitbrain agora usa o UTMify MCP como fonte oficial de dados, sem
            depender de upload de planilha.
          </p>
        </div>
        <button
          onClick={() => router.push('/utmify-sync')}
          className="inline-flex items-center gap-2 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', boxShadow: '0 0 0 1px rgba(124,58,237,0.4)' }}
        >
          Ir para UTMify Sync
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </PageShell>
  )
}
