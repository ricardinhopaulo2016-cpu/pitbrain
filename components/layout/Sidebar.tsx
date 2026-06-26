'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
} from 'lucide-react'
import { useSessionStore } from '@/store/sessionStore'

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart2 },
  { href: '/upload', label: 'Upload de Dados', icon: Upload },
  { href: '/diagnostico', label: 'Diagnóstico IA', icon: Brain },
  { href: '/funil', label: 'Funil', icon: GitFork },
  { href: '/campanhas', label: 'Campanhas', icon: Megaphone },
  { href: '/criativos', label: 'Criativos', icon: Sparkles },
  { href: '/rascunhos', label: 'Rascunhos', icon: FileText },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sessionId, diagnosis } = useSessionStore()

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-pb-card border-r border-pb-border flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-pb-border">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-pb-purple flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-pb-text text-sm leading-none tracking-wide">PITBRAIN</p>
            <p className="text-[10px] text-pb-muted mt-0.5 tracking-widest uppercase">Ads Intelligence</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {links.map(link => {
          const Icon = link.icon
          const active = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                active
                  ? 'bg-pb-card-alt text-pb-text border-l-2 border-pb-purple pl-[10px]'
                  : 'text-pb-muted hover:text-pb-text hover:bg-pb-card-alt border-l-2 border-transparent'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-pb-purple' : 'text-pb-muted group-hover:text-pb-text')} />
              {link.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer status */}
      <div className="px-4 py-4 border-t border-pb-border space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-pb-green animate-pulse shrink-0" />
          <span className="text-xs text-pb-muted">IA Online</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-pb-border">Provider</span>
          <span className="text-xs text-pb-text font-medium">OpenAI</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-pb-border">Sessão</span>
          <span className="text-xs text-pb-muted truncate max-w-[90px]">
            {sessionId ? sessionId.slice(0, 8) + '…' : 'nenhuma'}
          </span>
        </div>
        {diagnosis && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-pb-border">Análise</span>
            <span className="text-xs text-pb-green">concluída</span>
          </div>
        )}
      </div>
    </aside>
  )
}
