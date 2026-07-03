'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  BarChart2,
  Upload,
  Brain,
  GitFork,
  Megaphone,
  Sparkles,
  FileText,
  Settings,
  Zap,
  Layers,
  Database,
  RefreshCw,
  EyeOff,
  LogOut,
  Plug,
} from 'lucide-react'
import { useSessionStore } from '@/store/sessionStore'
import { getStorageMode } from '@/lib/storage/mode'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

const links = [
  { href: '/dashboard',    label: 'Dashboard',        icon: BarChart2  },
  { href: '/upload',       label: 'Upload UTMify',    icon: Upload     },
  { href: '/imports',      label: 'Imports Salvos',   icon: Database   },
  { href: '/diagnostico',  label: 'Diagnóstico Local', icon: Brain     },
  { href: '/funil',        label: 'Funil',             icon: GitFork    },
  { href: '/criativos',    label: 'Criativos',         icon: Sparkles   },
  { href: '/campanhas',    label: 'Campanhas',         icon: Megaphone  },
  { href: '/configuracoes',label: 'Configurações',     icon: Settings   },
]

const systemLinks = [
  { href: '/meta-sync',    label: 'Meta Sync',    icon: RefreshCw },
  { href: '/dark-posts',   label: 'Dark Posts',   icon: EyeOff    },
  { href: '/utmify-sync',  label: 'UTMify Sync',  icon: Plug      },
]

const futureLinks = [
  { label: 'Estrutura (Pit Planilhas)', icon: Layers },
  { label: 'Rascunhos (em breve)',      icon: FileText },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { sessionId, diagnosis } = useSessionStore()
  const storageMode = getStorageMode()
  const [account, setAccount] = useState<{ email: string; workspaceName: string | null } | null>(null)

  useEffect(() => {
    if (storageMode !== 'supabase') return
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) setAccount({ email: data.user.email, workspaceName: data.workspaceName })
      })
      .catch(() => {})
  }, [storageMode])

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient()
    await supabase?.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const providerEnv = process.env.NEXT_PUBLIC_AI_PROVIDER ?? 'openai'
  const aiProvider = providerEnv === 'mock'
    ? 'Diagnóstico Local'
    : providerEnv === 'anthropic'
      ? 'Claude Sonnet'
      : 'OpenAI'

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 flex flex-col z-40"
      style={{ background: 'linear-gradient(180deg, #0A0A18 0%, #080814 100%)', borderRight: '1px solid #1E1E35' }}
    >
      {/* ── Logo ──────────────────────────────────────────────── */}
      <div className="px-5 py-5" style={{ borderBottom: '1px solid #1A1A2E' }}>
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all group-hover:scale-105"
            style={{ background: 'rgba(124, 58, 237, 0.18)', border: '1px solid rgba(124, 58, 237, 0.35)', boxShadow: '0 0 12px rgba(124, 58, 237, 0.15)' }}
          >
            <Zap className="h-4 w-4 text-pb-purple" />
          </div>
          <div>
            <p className="logo-gradient font-black text-sm leading-none tracking-[0.18em]">PITBRAIN</p>
            <p className="text-[9px] text-pb-faint mt-1 tracking-[0.22em] uppercase font-medium">Ads Intelligence</p>
          </div>
        </Link>
      </div>

      {/* ── Nav ───────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-[9px] text-pb-border/80 uppercase tracking-[0.18em] px-3 mb-3 font-semibold">Navegação</p>

        <div className="space-y-0.5">
          {links.map(link => {
            const Icon = link.icon
            const active = pathname === link.href ||
              (link.href !== '/' && pathname.startsWith(link.href))

            return (
              <div key={link.href} className="relative">
                {active && (
                  <span
                    className="absolute left-0 rounded-full"
                    style={{
                      top: '8px', bottom: '8px', width: '2px',
                      background: 'linear-gradient(180deg, #9F67FF 0%, #7C3AED 100%)',
                      boxShadow: '0 0 8px rgba(124, 58, 237, 0.6)',
                    }}
                  />
                )}
                <Link
                  href={link.href}
                  className={cn(
                    'flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                    active ? 'text-pb-text text-glow-purple pl-5 pr-3' : 'text-pb-secondary hover:text-pb-text px-3'
                  )}
                  style={active ? {
                    background: 'rgba(124, 58, 237, 0.10)',
                    border: '1px solid rgba(124, 58, 237, 0.12)',
                  } : undefined}
                >
                  <Icon className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    active ? 'text-pb-purple' : 'text-pb-muted/60 group-hover:text-pb-muted'
                  )} />
                  {link.label}
                </Link>
              </div>
            )
          })}
        </div>

        {/* System / Meta integration */}
        <p className="text-[9px] text-pb-border/80 uppercase tracking-[0.18em] px-3 mb-3 mt-5 font-semibold">Sistema</p>
        <div className="space-y-0.5">
          {systemLinks.map(link => {
            const Icon = link.icon
            const active = pathname === link.href || pathname.startsWith(link.href)

            return (
              <div key={link.href} className="relative">
                {active && (
                  <span
                    className="absolute left-0 rounded-full"
                    style={{
                      top: '8px', bottom: '8px', width: '2px',
                      background: 'linear-gradient(180deg, #9F67FF 0%, #7C3AED 100%)',
                      boxShadow: '0 0 8px rgba(124, 58, 237, 0.6)',
                    }}
                  />
                )}
                <Link
                  href={link.href}
                  className={cn(
                    'flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                    active ? 'text-pb-text text-glow-purple pl-5 pr-3' : 'text-pb-secondary hover:text-pb-text px-3'
                  )}
                  style={active ? {
                    background: 'rgba(124, 58, 237, 0.10)',
                    border: '1px solid rgba(124, 58, 237, 0.12)',
                  } : undefined}
                >
                  <Icon className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    active ? 'text-pb-purple' : 'text-pb-muted/60 group-hover:text-pb-muted'
                  )} />
                  {link.label}
                </Link>
              </div>
            )
          })}
        </div>

        {/* Future / placeholder items */}
        <p className="text-[9px] text-pb-border/50 uppercase tracking-[0.18em] px-3 mb-3 mt-5 font-semibold">Em breve</p>
        <div className="space-y-0.5">
          {futureLinks.map(link => {
            const Icon = link.icon
            return (
              <div key={link.label} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-pb-border/40 cursor-not-allowed select-none text-sm">
                <Icon className="h-4 w-4 shrink-0" />
                {link.label}
              </div>
            )
          })}
        </div>
      </nav>

      {/* ── Account block ─────────────────────────────────────── */}
      {storageMode === 'supabase' && account && (
        <div className="px-4 py-3 space-y-2" style={{ borderTop: '1px solid #1A1A2E' }}>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-pb-text truncate">{account.email}</p>
            {account.workspaceName && (
              <p className="text-[10px] text-pb-border/70 truncate">{account.workspaceName}</p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-[11px] text-pb-secondary hover:text-pb-red transition-colors"
          >
            <LogOut className="h-3 w-3" />
            Sair
          </button>
        </div>
      )}

      {/* ── Status footer ─────────────────────────────────────── */}
      <div className="px-4 py-4 space-y-3" style={{ borderTop: '1px solid #1A1A2E' }}>
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full bg-pb-green shrink-0"
            style={{ animation: 'status-blink 1.8s ease-in-out infinite' }}
          />
          <span className="text-xs font-semibold text-pb-text">IA Online</span>
        </div>
        <div className="space-y-1.5 pt-0.5">
          <FooterRow label="Provider" value={aiProvider} />
          <FooterRow
            label="Sessão"
            value={sessionId ? sessionId.slice(0, 8) + '…' : 'nenhuma'}
            dim={!sessionId}
          />
          {diagnosis && <FooterRow label="Análise" value="concluída" accent="green" />}
        </div>
      </div>
    </aside>
  )
}

function FooterRow({ label, value, dim, accent }: { label: string; value: string; dim?: boolean; accent?: 'green' }) {
  const valueClass = accent === 'green' ? 'text-pb-green' : dim ? 'text-pb-border' : 'text-pb-muted'
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-[0.12em] text-pb-border/70 font-medium">{label}</span>
      <span className={cn('text-[10px] font-semibold truncate max-w-[90px]', valueClass)}>{value}</span>
    </div>
  )
}
