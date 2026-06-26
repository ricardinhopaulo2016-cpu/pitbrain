import Link from 'next/link'
import { PageShell } from '@/components/layout/PageShell'
import { BarChart2, Upload, Brain, FileText, ArrowRight, Zap, Shield } from 'lucide-react'

const features = [
  {
    icon: Upload,
    title: 'Upload de CSVs',
    description: 'Importe dados do Meta Ads e UTMify em segundos. Suporte a diferentes versões de exportação.',
    color: 'text-pb-blue',
    bg: 'bg-pb-blue/10',
    border: 'border-pb-blue/20',
  },
  {
    icon: BarChart2,
    title: 'Métricas Calculadas',
    description: 'ROAS, CPA, CTR, CPM, CPC e taxas de conversão por estágio de funil — calculadas em código, sem achismos.',
    color: 'text-pb-purple',
    bg: 'bg-pb-purple/10',
    border: 'border-pb-purple/20',
  },
  {
    icon: Brain,
    title: 'Diagnóstico por IA',
    description: 'IA analisa apenas os dados calculados e gera diagnóstico estruturado por topo, meio e fundo de funil.',
    color: 'text-pb-green',
    bg: 'bg-pb-green/10',
    border: 'border-pb-green/20',
  },
  {
    icon: FileText,
    title: 'Rascunhos de Campanha',
    description: 'Sugestões de estrutura de campanha baseadas no diagnóstico — sem publicar nada na Meta.',
    color: 'text-pb-yellow',
    bg: 'bg-pb-yellow/10',
    border: 'border-pb-yellow/20',
  },
]

const steps = [
  { step: '01', label: 'Faça upload dos CSVs', href: '/upload', color: 'text-pb-blue' },
  { step: '02', label: 'Veja o dashboard de métricas', href: '/dashboard', color: 'text-pb-purple' },
  { step: '03', label: 'Gere o diagnóstico IA', href: '/diagnostico', color: 'text-pb-green' },
  { step: '04', label: 'Revise os rascunhos', href: '/rascunhos', color: 'text-pb-yellow' },
]

export default function HomePage() {
  return (
    <PageShell>
      {/* Hero */}
      <div className="text-center py-16 space-y-6">
        <div className="inline-flex items-center gap-2 bg-pb-purple/10 text-pb-purple border border-pb-purple/30 px-4 py-1.5 rounded-full text-sm font-medium">
          <Zap className="h-3.5 w-3.5" />
          MVP — Análise Inteligente de Tráfego Pago
        </div>
        <h1 className="text-5xl font-black text-pb-text tracking-tight">
          PIT<span className="text-pb-purple">BRAIN</span>
        </h1>
        <p className="text-lg text-pb-muted max-w-2xl mx-auto leading-relaxed">
          Carregue seus dados de Meta Ads e UTMify, calcule métricas de funil e receba
          um diagnóstico estruturado gerado por IA — tudo sem tocar nas suas campanhas.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 bg-pb-purple hover:bg-pb-purple/90 text-white font-semibold px-6 py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-pb-purple/20"
          >
            Começar agora
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 border border-pb-border hover:border-pb-purple/40 text-pb-muted hover:text-pb-text font-medium px-6 py-3 rounded-xl transition-all"
          >
            Ver dashboard
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        {features.map(f => (
          <div key={f.title} className={`bg-pb-card border ${f.border} rounded-xl p-5 space-y-3`}>
            <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center`}>
              <f.icon className={`h-5 w-5 ${f.color}`} />
            </div>
            <h3 className="font-semibold text-pb-text">{f.title}</h3>
            <p className="text-sm text-pb-muted leading-relaxed">{f.description}</p>
          </div>
        ))}
      </div>

      {/* Steps */}
      <div className="mt-16">
        <h2 className="text-xl font-bold text-pb-text mb-6 text-center">Como funciona</h2>
        <div className="flex flex-col md:flex-row gap-3">
          {steps.map((s, i) => (
            <Link key={s.step} href={s.href} className="flex-1 group">
              <div className="border border-pb-border rounded-xl p-5 bg-pb-card hover:border-pb-purple/40 hover:bg-pb-card-alt transition-all space-y-2">
                <span className={`text-3xl font-black ${s.color} opacity-30 group-hover:opacity-60 transition-opacity`}>
                  {s.step}
                </span>
                <p className="font-medium text-pb-text text-sm">{s.label}</p>
                {i < steps.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-pb-border group-hover:text-pb-purple transition-colors" />
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-12 p-4 bg-pb-card-alt border border-pb-border rounded-xl flex items-center gap-3 max-w-2xl mx-auto">
        <Shield className="h-4 w-4 text-pb-muted shrink-0" />
        <p className="text-xs text-pb-muted leading-relaxed">
          Este sistema é somente para análise de dados. Não cria, edita ou publica campanhas na Meta.
          Não automatiza contas de anúncio. A IA usa apenas dados calculados pelo backend.
        </p>
      </div>
    </PageShell>
  )
}
