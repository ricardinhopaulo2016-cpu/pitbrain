'use client'

import { useState } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { Settings, Save, RotateCcw, Check } from 'lucide-react'

interface BrainRules {
  cpaTarget: string
  roasMin: string
  roasGood: string
  cpcMin: string
  cpcMax: string
  cpmMin: string
  cpmMax: string
  ctrMin: string
  icToSaleMin: string
  icToSaleGood: string
}

type ProfileKey = 'fleyn' | 'creators' | 'custom'

interface Profile {
  key: ProfileKey
  label: string
  description: string
  values: BrainRules
}

const PROFILES: Profile[] = [
  {
    key: 'fleyn',
    label: 'Fleyn',
    description: 'Perfil para produtos físicos premium — CPA 270, ROAS 1.5–2x, CPM alto',
    values: {
      cpaTarget: '270',
      roasMin: '1.5',
      roasGood: '2',
      cpcMin: '3',
      cpcMax: '5',
      cpmMin: '60',
      cpmMax: '90',
      ctrMin: '1',
      icToSaleMin: '15',
      icToSaleGood: '20',
    },
  },
  {
    key: 'creators',
    label: 'Creators',
    description: 'Produtos digitais / infoprodutos — CPA menor, ROAS mais agressivo',
    values: {
      cpaTarget: '80',
      roasMin: '2',
      roasGood: '4',
      cpcMin: '0.5',
      cpcMax: '2',
      cpmMin: '10',
      cpmMax: '40',
      ctrMin: '1.5',
      icToSaleMin: '20',
      icToSaleGood: '35',
    },
  },
  {
    key: 'custom',
    label: 'Personalizado',
    description: 'Defina suas próprias metas e limites para o diagnóstico',
    values: {
      cpaTarget: '50',
      roasMin: '1.5',
      roasGood: '3',
      cpcMin: '1',
      cpcMax: '3',
      cpmMin: '20',
      cpmMax: '60',
      ctrMin: '1',
      icToSaleMin: '20',
      icToSaleGood: '35',
    },
  },
]

function FieldGroup({ label, description, id, value, onChange, prefix, suffix }: {
  label: string
  description: string
  id: keyof BrainRules
  value: string
  onChange: (id: keyof BrainRules, v: string) => void
  prefix?: string
  suffix?: string
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-pb-border last:border-0">
      <div className="flex-1 mr-8">
        <label htmlFor={id} className="text-sm font-medium text-pb-text">{label}</label>
        <p className="text-xs text-pb-muted mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {prefix && <span className="text-xs text-pb-muted">{prefix}</span>}
        <input
          id={id}
          type="number"
          step="0.01"
          value={value}
          onChange={e => onChange(id, e.target.value)}
          className="w-24 bg-pb-card-alt border border-pb-border rounded-lg px-3 py-2 text-sm text-pb-text text-right focus:outline-none focus:border-pb-purple/60 transition-colors"
        />
        {suffix && <span className="text-xs text-pb-muted">{suffix}</span>}
      </div>
    </div>
  )
}

export default function ConfiguracoesPage() {
  const [activeProfile, setActiveProfile] = useState<ProfileKey>('fleyn')
  const [rules, setRules] = useState<BrainRules>(PROFILES[0].values)
  const [saved, setSaved] = useState(false)

  function applyProfile(key: ProfileKey) {
    const profile = PROFILES.find(p => p.key === key)
    if (!profile) return
    setActiveProfile(key)
    setRules(profile.values)
    setSaved(false)
  }

  function handleChange(id: keyof BrainRules, value: string) {
    setActiveProfile('custom')
    setRules(prev => ({ ...prev, [id]: value }))
    setSaved(false)
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function handleReset() {
    const profile = PROFILES.find(p => p.key === activeProfile) ?? PROFILES[0]
    setRules(profile.values)
    setSaved(false)
  }

  interface Field { id: keyof BrainRules; label: string; description: string; prefix?: string; suffix?: string }
  const sections: { title: string; fields: Field[] }[] = [
    {
      title: 'Metas de ROAS e CPA',
      fields: [
        { id: 'cpaTarget',   label: 'CPA Alvo',      description: 'Custo por aquisição que o negócio suporta',              prefix: 'R$' },
        { id: 'roasMin',     label: 'ROAS Mínimo',   description: 'Abaixo disso a campanha está no break-even ou prejuízo',  suffix: 'x'  },
        { id: 'roasGood',    label: 'ROAS Bom',      description: 'Acima disso a campanha é candidata a escala',             suffix: 'x'  },
      ],
    },
    {
      title: 'Limites de Custo por Clique',
      fields: [
        { id: 'cpcMin',      label: 'CPC Mínimo',    description: 'Abaixo disso o tráfego pode ser de baixa qualidade',     prefix: 'R$' },
        { id: 'cpcMax',      label: 'CPC Máximo',    description: 'Acima disso o tráfego é considerado caro demais',        prefix: 'R$' },
        { id: 'cpmMin',      label: 'CPM Mínimo',    description: 'Referência de CPM para público de qualidade',            prefix: 'R$' },
        { id: 'cpmMax',      label: 'CPM Máximo',    description: 'Custo por mil impressões considerado alto demais',       prefix: 'R$' },
        { id: 'ctrMin',      label: 'CTR Mínimo',    description: 'Abaixo disso o criativo está com baixo engajamento',     suffix: '%'  },
      ],
    },
    {
      title: 'Taxas de Funil',
      fields: [
        { id: 'icToSaleMin',  label: 'IC → Venda Mínimo', description: 'Taxa mínima de Initiate Checkout para compra',  suffix: '%' },
        { id: 'icToSaleGood', label: 'IC → Venda Bom',    description: 'Taxa que indica funil saudável',                suffix: '%' },
      ],
    },
  ]

  return (
    <PageShell className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pb-text">Configurações</h1>
          <p className="text-pb-muted text-sm mt-0.5">Regras do diagnóstico — parâmetros de avaliação de campanhas</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 border border-pb-border text-pb-muted hover:text-pb-text px-4 py-2 rounded-xl text-sm transition-all"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Resetar
          </button>
          <button
            onClick={handleSave}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all ${
              saved
                ? 'bg-pb-green/20 border border-pb-green/30 text-pb-green'
                : 'bg-pb-purple hover:bg-pb-purple/90 text-white'
            }`}
          >
            <Save className="h-3.5 w-3.5" />
            {saved ? 'Salvo!' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Profile selector */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-pb-border font-semibold mb-3">Perfil de regras</p>
        <div className="grid grid-cols-3 gap-2.5">
          {PROFILES.map(profile => {
            const isActive = activeProfile === profile.key
            return (
              <button
                key={profile.key}
                onClick={() => applyProfile(profile.key)}
                className={`relative text-left rounded-xl p-4 border transition-all ${
                  isActive
                    ? 'border-pb-purple/40 text-pb-text'
                    : 'border-pb-border text-pb-muted hover:border-pb-border/60 hover:text-pb-text'
                }`}
                style={isActive ? { background: 'rgba(124,58,237,0.08)' } : { background: '#10101D' }}
              >
                {isActive && (
                  <span className="absolute top-3 right-3 w-4 h-4 rounded-full bg-pb-purple flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </span>
                )}
                <p className={`text-sm font-semibold mb-1 ${isActive ? 'text-pb-purple' : ''}`}>{profile.label}</p>
                <p className="text-[11px] text-pb-muted leading-relaxed">{profile.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Info */}
      <div className="bg-pb-card-alt border border-pb-border rounded-xl p-4 flex gap-3">
        <Settings className="h-4 w-4 text-pb-muted shrink-0 mt-0.5" />
        <p className="text-xs text-pb-muted leading-relaxed">
          Estes parâmetros são usados pelo diagnóstico IA para classificar campanhas como <span className="text-pb-green">bom</span>, <span className="text-pb-yellow">atenção</span> ou <span className="text-pb-red">crítico</span>.
          Ajuste conforme as metas do seu negócio ou selecione um perfil acima.
        </p>
      </div>

      {/* Sections */}
      {sections.map(section => (
        <div key={section.title} className="bg-pb-card border border-pb-border rounded-xl px-5 py-2">
          <h2 className="font-semibold text-pb-text text-sm py-4 border-b border-pb-border">{section.title}</h2>
          {section.fields.map(field => (
            <FieldGroup
              key={field.id}
              id={field.id}
              label={field.label}
              description={field.description}
              value={rules[field.id]}
              onChange={handleChange}
              prefix={field.prefix}
              suffix={field.suffix}
            />
          ))}
        </div>
      ))}
    </PageShell>
  )
}
