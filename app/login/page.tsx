'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { AlertCircle, AlertTriangle, CheckCircle2, XCircle, Loader2, Brain, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

const UNAUTHORIZED_MESSAGE = 'Acesso não autorizado. Este e-mail não tem permissão para acessar o Pitbrain.'

function EnvChecklistRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-pb-muted font-mono truncate">{label}</span>
      <span className={cn('flex items-center gap-1 font-medium shrink-0', ok ? 'text-pb-green' : 'text-pb-red')}>
        {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
        {ok ? 'configurada' : 'ausente'}
      </span>
    </div>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // NEXT_PUBLIC_ vars are inlined at build time — safe to read directly here,
  // and this is what actually tells us whether login can work at all.
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const envConfigured = hasUrl && hasAnonKey

  useEffect(() => {
    if (searchParams.get('error') === 'unauthorized') setError(UNAUTHORIZED_MESSAGE)
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!envConfigured) return // button is disabled for this case — safety net only

    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      setError('Supabase não configurado neste ambiente.')
      return
    }

    setLoading(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (signInError) {
      setError('E-mail ou senha inválidos.')
      return
    }

    router.push(searchParams.get('redirect') ?? '/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-pb-bg px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-pb-purple/15 border border-pb-purple/30 flex items-center justify-center">
            <Brain className="h-6 w-6 text-pb-purple" />
          </div>
          <h1 className="text-xl font-bold text-pb-text">Entrar no Pitbrain</h1>
          <p className="text-pb-muted text-sm">Inteligência operacional para tráfego pago.</p>
        </div>

        {/* Environment diagnostic — informative, not a generic error */}
        {!envConfigured && (
          <div className="bg-pb-blue/[0.07] border border-pb-blue/20 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-pb-blue shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-pb-text font-medium">Supabase não configurado neste ambiente.</p>
                <p className="text-[11px] text-pb-muted mt-0.5">
                  Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY na Vercel e faça Redeploy.
                </p>
              </div>
            </div>
            <div className="space-y-1.5 pt-2.5 border-t border-pb-blue/15">
              <EnvChecklistRow label="NEXT_PUBLIC_SUPABASE_URL" ok={hasUrl} />
              <EnvChecklistRow label="NEXT_PUBLIC_SUPABASE_ANON_KEY" ok={hasAnonKey} />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-pb-card border border-pb-border rounded-xl p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-pb-muted">E-mail</label>
            <input
              type="email"
              required
              autoFocus
              disabled={!envConfigured}
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-pb-card-alt border border-pb-border rounded-lg px-3 py-2 text-sm text-pb-text focus:outline-none focus:border-pb-purple/60 disabled:opacity-50"
              placeholder="voce@empresa.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-pb-muted">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                disabled={!envConfigured}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-pb-card-alt border border-pb-border rounded-lg px-3 py-2 pr-10 text-sm text-pb-text focus:outline-none focus:border-pb-purple/60 disabled:opacity-50"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-pb-muted hover:text-pb-purple transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-pb-red/10 border border-pb-red/30 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-pb-red shrink-0" />
              <p className="text-pb-red text-xs">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !envConfigured}
            title={!envConfigured ? 'Configure o Supabase para habilitar login.' : undefined}
            className="w-full inline-flex items-center justify-center gap-2 bg-pb-purple hover:bg-pb-purple/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-4 py-2.5 rounded-xl transition-all text-sm"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Entrando…</> : 'Entrar'}
          </button>
          {!envConfigured && (
            <p className="text-center text-[11px] text-pb-muted">Configure o Supabase para habilitar login.</p>
          )}
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
