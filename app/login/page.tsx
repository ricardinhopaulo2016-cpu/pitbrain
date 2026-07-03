'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { InsightCard } from '@/components/dashboard/InsightCard'
import { AlertCircle, AlertTriangle, CheckCircle2, XCircle, Loader2, Zap, Eye, EyeOff, ShieldCheck } from 'lucide-react'
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
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-pb-bg">
      {/* ── Left: login form ─────────────────────────────────────────── */}
      <div className="grid-overlay flex items-center justify-center px-4 py-12 relative overflow-hidden">
        <div
          className="absolute top-0 left-0 w-[500px] h-[400px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top left, rgba(124,58,237,0.08) 0%, transparent 70%)' }}
        />

        <div className="w-full max-w-[420px] space-y-6 relative animate-fade-in">
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(124, 58, 237, 0.18)', border: '1px solid rgba(124, 58, 237, 0.35)', boxShadow: '0 0 16px rgba(124, 58, 237, 0.18)' }}
            >
              <Zap className="h-6 w-6 text-pb-purple" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-pb-text text-glow-purple">Entrar no Pitbrain</h1>
              <p className="text-pb-muted text-sm mt-1">Inteligência operacional para tráfego pago.</p>
              <p className="text-pb-border text-[11px] mt-2 uppercase tracking-[0.14em] font-medium">Acesso interno autorizado</p>
            </div>
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

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl p-7 space-y-5"
            style={{
              background: 'linear-gradient(160deg, #12121F 0%, #0D0D1A 100%)',
              border: '1px solid rgba(42,42,64,0.8)',
              boxShadow: '0 0 40px rgba(124,58,237,0.06), 0 20px 50px rgba(0,0,0,0.4)',
            }}
          >
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-pb-muted">E-mail</label>
              <input
                type="email"
                required
                autoFocus
                disabled={!envConfigured}
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-12 bg-pb-card-alt border border-pb-border rounded-lg px-3.5 text-sm text-pb-text focus:outline-none focus:border-pb-purple/70 focus:ring-2 focus:ring-pb-purple/20 transition-colors disabled:opacity-50"
                placeholder="dis@empresa.com"
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
                  className="w-full h-12 bg-pb-card-alt border border-pb-border rounded-lg px-3.5 pr-11 text-sm text-pb-text focus:outline-none focus:border-pb-purple/70 focus:ring-2 focus:ring-pb-purple/20 transition-colors disabled:opacity-50"
                  placeholder="sua senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pb-muted hover:text-pb-purple transition-colors"
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
              className="w-full h-12 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm hover:opacity-90 active:scale-[0.99]"
              style={{
                background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                boxShadow: loading || !envConfigured ? 'none' : '0 0 0 1px rgba(124,58,237,0.4), 0 6px 20px rgba(124,58,237,0.25)',
              }}
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Entrando…</> : 'Entrar'}
            </button>
            {!envConfigured && (
              <p className="text-center text-[11px] text-pb-muted">Configure o Supabase para habilitar login.</p>
            )}
          </form>
        </div>
      </div>

      {/* ── Right: static preview panel, desktop only ────────────────── */}
      <div
        className="hidden lg:flex items-center justify-center px-10 relative overflow-hidden"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 25%, rgba(124,58,237,0.10) 0%, transparent 70%)' }}
      >
        <div className="w-full max-w-md space-y-4 animate-slide-up">
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{
              background: 'linear-gradient(160deg, #12121F 0%, #0D0D1A 100%)',
              border: '1px solid rgba(42,42,64,0.8)',
              boxShadow: '0 0 60px rgba(124,58,237,0.08), 0 40px 80px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid rgba(42,42,64,0.5)' }}>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-pb-green" style={{ animation: 'status-blink 1.8s ease-in-out infinite' }} />
                <span className="text-xs text-pb-muted font-medium">Dados prontos para diagnóstico</span>
              </div>
              <ShieldCheck className="h-3.5 w-3.5 text-pb-border" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <MetricCard title="ROAS" value="1.06x" subtitle="abaixo do mínimo op." highlight="critical" />
              <MetricCard title="CPA" value="R$47" subtitle="custo por compra" highlight="warning" />
              <MetricCard title="CTR" value="1.61%" subtitle="cliques / impressões" highlight="warning" />
            </div>

            <InsightCard
              title="Gargalo detectado"
              status="crítico"
              diagnosis="ROAS abaixo do mínimo operacional de 1.5x."
              evidence="ROAS atual: 1.06x  |  Meta mínima: 1.5x"
              action="Revisar oferta, checkout e eficiência dos públicos antes de escalar."
              priority="alta"
              risk="Médio"
            />

            <div className="rounded-xl px-4 py-3 space-y-2" style={{ background: 'rgba(7,7,18,0.6)', border: '1px solid rgba(42,42,64,0.4)' }}>
              <p className="text-[10px] text-pb-border uppercase tracking-[0.15em] font-semibold">Funil de conversão</p>
              <div className="space-y-1.5">
                {[
                  { label: 'Impressões', pct: 100, color: '#38BDF8' },
                  { label: 'Cliques', pct: 62, color: '#7C3AED' },
                  { label: 'Page Views', pct: 45, color: '#38BDF8' },
                  { label: 'IC / Add To Cart', pct: 22, color: '#FACC15' },
                  { label: 'Compras', pct: 8, color: '#22C55E' },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-2">
                    <span className="text-[10px] text-pb-muted/70 w-24 shrink-0">{row.label}</span>
                    <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(42,42,64,0.5)' }}>
                      <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: row.color, opacity: 0.7 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
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
