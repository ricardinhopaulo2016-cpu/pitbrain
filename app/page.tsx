import Link from 'next/link'
import { PageShell } from '@/components/layout/PageShell'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { InsightCard } from '@/components/dashboard/InsightCard'
import { getStorageMode } from '@/lib/storage/mode'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import {
  ArrowRight,
  Zap,
  Upload,
  BarChart2,
  Brain,
  FileText,
  CheckCircle2,
  Activity,
  LogIn,
} from 'lucide-react'

const featureList = [
  { icon: Upload,    label: 'Upload Meta Ads + UTMify'           },
  { icon: BarChart2, label: 'Métricas calculadas, sem achismos'  },
  { icon: Brain,     label: 'Diagnóstico estruturado por IA'     },
  { icon: FileText,  label: 'Rascunhos de campanha pós-análise'  },
]

const steps = [
  { n: '01', label: 'Faça upload dos CSVs',        href: '/upload',      color: '#38BDF8' },
  { n: '02', label: 'Veja o dashboard de métricas', href: '/dashboard',   color: '#7C3AED' },
  { n: '03', label: 'Gere o diagnóstico IA',        href: '/diagnostico', color: '#22C55E' },
  { n: '04', label: 'Revise os rascunhos',          href: '/rascunhos',   color: '#FACC15' },
]

export default async function HomePage() {
  const storageMode = getStorageMode()
  const user = storageMode === 'supabase' ? await getCurrentUser() : null

  return (
    <PageShell className="space-y-0 py-0 px-0">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative px-6 pt-12 pb-16 grid-overlay overflow-hidden">
        {/* Background glow */}
        <div
          className="absolute top-0 right-0 w-[600px] h-[400px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top right, rgba(124,58,237,0.09) 0%, transparent 70%)' }}
        />

        <div className="grid lg:grid-cols-5 gap-10 items-center max-w-[1280px]">

          {/* ── Left: copy ──────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-7 animate-fade-in">
            {/* Status chip */}
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{
                background: 'rgba(124, 58, 237, 0.1)',
                border: '1px solid rgba(124, 58, 237, 0.25)',
                color: '#A78BFA',
              }}
            >
              <Zap className="h-3 w-3" />
              Operational Intelligence — MVP
            </div>

            {/* Headline */}
            <div className="space-y-3">
              <h1 className="text-5xl font-black text-pb-text tracking-tight leading-[1.05]">
                PIT<span style={{ color: '#7C3AED' }}>BRAIN</span>
              </h1>
              <p className="text-lg font-medium text-pb-muted leading-snug">
                Inteligência operacional<br />para tráfego pago.
              </p>
            </div>

            {/* Body copy */}
            <p className="text-sm text-pb-muted/80 leading-relaxed max-w-sm">
              Importe dados, valide métricas e detecte gargalos antes de escalar.
              Diagnóstico estruturado por IA — sem tocar nas suas campanhas.
            </p>

            {/* CTAs */}
            <div className="flex items-center gap-3 flex-wrap">
              {storageMode === 'supabase' && !user ? (
                <>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                      boxShadow: '0 0 0 1px rgba(124,58,237,0.4), 0 6px 20px rgba(124,58,237,0.25)',
                    }}
                  >
                    <LogIn className="h-4 w-4" />
                    Entrar
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 font-medium px-5 py-2.5 rounded-xl text-sm transition-all hover:text-pb-text"
                    style={{ color: '#94A3B8', border: '1px solid rgba(42,42,64,0.8)' }}
                  >
                    Criar conta
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </>
              ) : storageMode === 'supabase' && user ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                    boxShadow: '0 0 0 1px rgba(124,58,237,0.4), 0 6px 20px rgba(124,58,237,0.25)',
                  }}
                >
                  <Activity className="h-4 w-4" />
                  Entrar no Pitbrain
                </Link>
              ) : (
                <>
                  <Link
                    href="/upload"
                    className="inline-flex items-center gap-2 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                      boxShadow: '0 0 0 1px rgba(124,58,237,0.4), 0 6px 20px rgba(124,58,237,0.25)',
                    }}
                  >
                    <Activity className="h-4 w-4" />
                    Começar análise
                  </Link>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 font-medium px-5 py-2.5 rounded-xl text-sm transition-all hover:text-pb-text"
                    style={{
                      color: '#94A3B8',
                      border: '1px solid rgba(42,42,64,0.8)',
                    }}
                  >
                    Ver dashboard
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </>
              )}
            </div>

            {/* Feature list */}
            <ul className="space-y-2 pt-1">
              {featureList.map(f => (
                <li key={f.label} className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-pb-green shrink-0" />
                  <span className="text-xs text-pb-muted">{f.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Right: dashboard preview ─────────────────────── */}
          <div className="lg:col-span-3 hidden lg:block animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{
                background: 'linear-gradient(160deg, #12121F 0%, #0D0D1A 100%)',
                border: '1px solid rgba(42,42,64,0.8)',
                boxShadow: '0 0 60px rgba(124,58,237,0.08), 0 40px 80px rgba(0,0,0,0.5)',
              }}
            >
              {/* Preview header */}
              <div className="flex items-center justify-between pb-3"
                style={{ borderBottom: '1px solid rgba(42,42,64,0.5)' }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-pb-green"
                    style={{ animation: 'status-blink 1.8s ease-in-out infinite' }}
                  />
                  <span className="text-xs text-pb-muted font-medium">
                    Dados prontos para diagnóstico
                  </span>
                </div>
                <span className="text-[10px] text-pb-border font-medium px-2 py-0.5 rounded-md"
                  style={{ background: 'rgba(21,21,40,0.8)', border: '1px solid rgba(42,42,64,0.5)' }}
                >
                  01/06 → 30/06/2026
                </span>
              </div>

              {/* Mini metric cards */}
              <div className="grid grid-cols-3 gap-2">
                <MetricCard title="ROAS"  value="1.06x"  subtitle="abaixo do mínimo op." highlight="critical" />
                <MetricCard title="CPA"   value="R$47"   subtitle="custo por compra"      highlight="warning"  />
                <MetricCard title="CTR"   value="1.61%"  subtitle="cliques / impressões"  highlight="warning"  />
              </div>

              {/* Mini insight */}
              <InsightCard
                title="Gargalo detectado"
                status="crítico"
                diagnosis="ROAS abaixo do mínimo operacional de 1.5x."
                evidence="ROAS atual: 1.06x  |  Meta mínima: 1.5x"
                action="Revisar oferta, checkout e eficiência dos públicos antes de escalar."
                priority="alta"
                risk="Médio"
              />

              {/* Mini funnel preview */}
              <div
                className="rounded-xl px-4 py-3 space-y-2"
                style={{ background: 'rgba(7,7,18,0.6)', border: '1px solid rgba(42,42,64,0.4)' }}
              >
                <p className="text-[10px] text-pb-border uppercase tracking-[0.15em] font-semibold">
                  Funil de conversão
                </p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Impressões', pct: 100, color: '#38BDF8' },
                    { label: 'Cliques',    pct: 62,  color: '#7C3AED' },
                    { label: 'Page Views', pct: 45,  color: '#38BDF8' },
                    { label: 'Checkouts',  pct: 18,  color: '#FACC15' },
                    { label: 'Compras',    pct: 8,   color: '#22C55E' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center gap-2">
                      <span className="text-[10px] text-pb-muted/70 w-20 shrink-0">{row.label}</span>
                      <div className="flex-1 h-1 rounded-full" style={{ background: 'rgba(42,42,64,0.5)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${row.pct}%`, background: row.color, opacity: 0.7 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Steps ─────────────────────────────────────────────────── */}
      <section className="px-6 py-12" style={{ borderTop: '1px solid rgba(42,42,64,0.4)' }}>
        <div className="max-w-[1280px]">
          <p className="text-[10px] uppercase tracking-[0.2em] text-pb-border font-semibold mb-6">
            Fluxo operacional
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {steps.map((s, i) => (
              <Link key={s.n} href={s.href} className="group">
                <div
                  className="rounded-xl p-5 space-y-3 transition-all hover:-translate-y-0.5"
                  style={{
                    background: '#10101D',
                    border: '1px solid #2A2A40',
                  }}
                >
                  <div className="flex items-end justify-between">
                    <span
                      className="text-3xl font-black leading-none"
                      style={{ color: s.color, opacity: 0.35 }}
                    >
                      {s.n}
                    </span>
                    {i < steps.length - 1 && (
                      <ArrowRight className="h-3.5 w-3.5 text-pb-border group-hover:text-pb-purple transition-colors" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-pb-text leading-tight">{s.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  )
}
