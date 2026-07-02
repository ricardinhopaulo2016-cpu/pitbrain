'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, ChevronDown, X, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MetaAdAccount } from '@/lib/meta/meta-types'

interface AdAccountComboboxProps {
  accounts: MetaAdAccount[]
  selectedId: string
  onSelect: (id: string) => void
  onClear: () => void
}

// Meta `account_status` codes — https://developers.facebook.com/docs/marketing-api/reference/ad-account/#fields
const STATUS_LABELS: Record<number, { label: string; cls: string }> = {
  1:   { label: 'Ativa',              cls: 'text-pb-green'  },
  2:   { label: 'Desativada',         cls: 'text-pb-red'    },
  3:   { label: 'Não confirmada',     cls: 'text-pb-yellow' },
  7:   { label: 'Em revisão de risco', cls: 'text-pb-yellow' },
  9:   { label: 'Período de carência', cls: 'text-pb-yellow' },
  100: { label: 'Fechamento pendente', cls: 'text-pb-red'   },
  101: { label: 'Fechada',            cls: 'text-pb-border' },
}

function statusOf(account: MetaAdAccount) {
  if (account.accountStatus === undefined) return null
  return STATUS_LABELS[account.accountStatus] ?? { label: `Status ${account.accountStatus}`, cls: 'text-pb-muted' }
}

function matchesQuery(account: MetaAdAccount, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const name = account.name.toLowerCase()
  const id = account.id.toLowerCase()
  const numericId = (account.accountId ?? id.replace(/^act_/, '')).toLowerCase()
  return name.includes(q) || id.includes(q) || numericId.includes(q)
}

export function AdAccountCombobox({ accounts, selectedId, onSelect, onClear }: AdAccountComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = accounts.find(a => a.id === selectedId)
  const filtered = accounts.filter(a => matchesQuery(a, query))

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  function openDropdown() {
    setQuery('')
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function handleSelect(id: string) {
    onSelect(id)
    setOpen(false)
    setQuery('')
  }

  async function handleCopy() {
    if (!selected) return
    try {
      await navigator.clipboard.writeText(selected.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  return (
    <div className="flex items-start gap-2">
      <div ref={containerRef} className="relative w-full max-w-sm">
        <label className="text-xs text-pb-muted mb-1 block">Ad account</label>

        {!open ? (
          <button
            type="button"
            onClick={openDropdown}
            className="w-full flex items-center justify-between gap-2 bg-pb-card-alt border border-pb-border rounded-lg px-3 py-2 text-left transition-colors hover:border-pb-purple/40 focus:outline-none focus:border-pb-purple/60"
          >
            {selected ? (
              <span className="min-w-0">
                <span className="block text-sm text-pb-text font-medium truncate">{selected.name}</span>
                <span className="block text-[11px] text-pb-muted font-mono truncate">{selected.id}</span>
              </span>
            ) : (
              <span className="text-sm text-pb-muted">Nenhuma conta selecionada</span>
            )}
            <ChevronDown className="h-4 w-4 text-pb-muted shrink-0" />
          </button>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-pb-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar conta por nome ou ID..."
              className="w-full bg-pb-card-alt border border-pb-purple/50 rounded-lg pl-9 pr-3 py-2 text-sm text-pb-text placeholder:text-pb-muted/60 focus:outline-none focus:border-pb-purple/70 focus:ring-2 focus:ring-pb-purple/20"
            />
          </div>
        )}

        {open && (
          <div
            className="absolute z-50 mt-1.5 w-full max-h-64 overflow-y-auto rounded-lg border border-pb-border shadow-lg"
            style={{ background: '#10101D' }}
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-pb-muted text-center">Nenhuma conta encontrada.</p>
            ) : (
              filtered.map(account => {
                const status = statusOf(account)
                const isSelected = account.id === selectedId
                return (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => handleSelect(account.id)}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left border-b border-pb-border/60 last:border-0 transition-colors',
                      isSelected ? 'bg-pb-purple/10' : 'hover:bg-pb-card'
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm text-pb-text font-medium truncate">{account.name}</span>
                      <span className="block text-[11px] text-pb-muted font-mono truncate">{account.id}</span>
                    </span>
                    {status && (
                      <span className={cn('text-[10px] font-semibold uppercase tracking-wide shrink-0', status.cls)}>
                        {status.label}
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 pt-6 shrink-0">
        <button
          type="button"
          onClick={handleCopy}
          disabled={!selected}
          title="Copiar ID"
          className="inline-flex items-center gap-1.5 text-xs text-pb-muted hover:text-pb-text border border-pb-border rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {copied ? <Check className="h-3 w-3 text-pb-green" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copiado' : 'Copiar ID'}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={!selectedId}
          title="Limpar seleção"
          className="inline-flex items-center gap-1.5 text-xs text-pb-muted hover:text-pb-red border border-pb-border rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <X className="h-3 w-3" />
          Limpar seleção
        </button>
      </div>
    </div>
  )
}
