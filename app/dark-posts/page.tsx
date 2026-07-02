'use client'

import { useEffect, useState } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EyeOff, ExternalLink, Plus } from 'lucide-react'
import { loadMetaDarkPosts } from '@/lib/meta/meta-storage'
import { parseAdName } from '@/lib/parsers/nomenclature-parser'
import type { MetaDarkPostAsset } from '@/lib/meta/meta-types'
import { cn } from '@/lib/utils'

export default function DarkPostsPage() {
  const [darkPosts, setDarkPosts] = useState<MetaDarkPostAsset[]>([])

  useEffect(() => {
    setDarkPosts(loadMetaDarkPosts())
  }, [])

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Dark Posts"
        chips={[{ label: `${darkPosts.length} detectados`, icon: EyeOff }]}
      />

      <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
        <EyeOff className="h-4 w-4 text-pb-blue shrink-0" />
        <p className="text-sm text-pb-text">
          Post IDs e Story IDs extraídos no último <span className="font-semibold">Meta Sync</span>. Somente leitura — nenhum criativo é alterado aqui.
        </p>
      </div>

      {darkPosts.length === 0 ? (
        <div className="bg-pb-card border border-pb-border rounded-xl p-8 text-center">
          <p className="text-sm text-pb-muted">Nenhum dark post detectado ainda. Rode um sync em <span className="text-pb-text">Meta Sync</span> primeiro.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-pb-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-pb-card-alt border-b border-pb-border hover:bg-pb-card-alt">
                <TableHead className="text-pb-muted text-xs uppercase tracking-wide">Produto/Funil</TableHead>
                <TableHead className="text-pb-muted text-xs uppercase tracking-wide">Campanha</TableHead>
                <TableHead className="text-pb-muted text-xs uppercase tracking-wide">Conjunto</TableHead>
                <TableHead className="text-pb-muted text-xs uppercase tracking-wide">Anúncio</TableHead>
                <TableHead className="text-pb-muted text-xs uppercase tracking-wide">Creative ID</TableHead>
                <TableHead className="text-pb-muted text-xs uppercase tracking-wide">Object Story ID</TableHead>
                <TableHead className="text-pb-muted text-xs uppercase tracking-wide">Post ID</TableHead>
                <TableHead className="text-pb-muted text-xs uppercase tracking-wide">Video ID</TableHead>
                <TableHead className="text-pb-muted text-xs uppercase tracking-wide">Permalink</TableHead>
                <TableHead className="text-pb-muted text-xs uppercase tracking-wide">Status</TableHead>
                <TableHead className="text-pb-muted text-xs uppercase tracking-wide">Dark Post</TableHead>
                <TableHead className="text-pb-muted text-xs uppercase tracking-wide">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {darkPosts.map(post => {
                const decoded = parseAdName(post.adName)
                const productFunnel = [decoded.produto, decoded.funil].filter(Boolean).join(' / ') || '—'

                return (
                  <TableRow key={post.adId} className="border-b border-pb-border last:border-0">
                    <TableCell className="text-pb-text text-sm">{productFunnel}</TableCell>
                    <TableCell className="text-pb-muted text-sm max-w-[160px] truncate">{post.campaignName}</TableCell>
                    <TableCell className="text-pb-muted text-sm max-w-[140px] truncate">{post.adsetName}</TableCell>
                    <TableCell className="text-pb-text text-sm max-w-[160px] truncate">{post.adName}</TableCell>
                    <TableCell className="text-pb-muted text-xs font-mono">{post.creativeId || '—'}</TableCell>
                    <TableCell className="text-pb-muted text-xs font-mono">{post.objectStoryId ?? post.effectiveObjectStoryId ?? '—'}</TableCell>
                    <TableCell className="text-pb-muted text-xs font-mono">{post.postId ?? '—'}</TableCell>
                    <TableCell className="text-pb-muted text-xs font-mono">{post.videoId ?? '—'}</TableCell>
                    <TableCell className="text-pb-muted text-xs">
                      {post.permalink ? (
                        <a href={post.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-pb-blue hover:underline">
                          Ver <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-pb-muted text-xs">{post.status}</TableCell>
                    <TableCell>
                      <span className={cn(
                        'text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md',
                        post.darkPostReady ? 'text-pb-green bg-pb-green/10' : 'text-pb-border bg-pb-card-alt'
                      )}>
                        {post.darkPostReady ? 'Pronto' : 'Incompleto'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        disabled
                        title="Biblioteca de Winners ainda não existe"
                        className="inline-flex items-center gap-1.5 text-xs text-pb-border border border-pb-border rounded-lg px-2.5 py-1.5 cursor-not-allowed opacity-60"
                      >
                        <Plus className="h-3 w-3" />
                        Adicionar à Biblioteca
                      </button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </PageShell>
  )
}
