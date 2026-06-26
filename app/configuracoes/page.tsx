'use client'

import { useState } from 'react'
import { PageShell } from '@/components/layout/PageShell'
import { Settings, Save, RotateCcw } from 'lucide-react'

interface BrainRules {
  cpaTarget: string
  roasMin: string
  roasGood: string
  cpcMax: string
  cpmMax: string
  ctrMin: string
  cpiIdeal: string
  pvToIcMin: string
  icToSaleMin: string
}

const defaultRules: BrainRules = {
  cpaTarget: '50',
  roasMin: '1.5',
  roasGood: '3',
  cpcMax: '2',
  cpmMax: '30',
  ctrMin: '1',
  cpiIdeal: '5',
  pvToIcMin: '15',
  icToSaleMin: '30',
}

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
  const [rules, setRules] = useState<BrainRules>(defaultRules)
  const [saved, setSaved] = useState(false)

  function handleChange(id: keyof BrainRules, value: string) {
    setRules(prev => ({ ...prev, [id]: value }))
    setSaved(false)
  }

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleReset() {
    setRules(defaultRules)
    setSaved(false)
  }

  const sections = [
    {
      title: 'Metas de ROAS e CPA',
      fields: [
        { id: 'cpaTarget' as const, label: 'CPA Alvo', description: 'Custo por aquisição que o negócio suporta', prefix: 'R$' },
        { id: 'roasMin' as const, label: 'ROAS Mínimo', description: 'Abaixo disso a campanha está no prejuízo', suffix: 'x' },
        { id: 'roasGood' as const, label: 'ROAS Bom', description: 'Acima disso a campanha é candidata a escala', suffix: 'x' },
      ],
    },
    {
      title: 'Limites de Custo por Clique',
      fields: [
        { id: 'cpcMax' as const, label: 'CPC Máximo', description: 'Custo por clique acima do qual o tráfego é inviável', prefix: 'R$' },
        { id: 'cpmMax' as const, label: 'CPM Máximo', description: 'Custo por mil impressões considerado alto demais', prefix: 'R$' },
        { id: 'ctrMin' as const, label: 'CTR Mínimo', description: 'Abaixo disso o criativo está com baixo engajamento', suffix: '%' },
      ],
    },
    {
      title: 'Taxas de Funil',
      fields: [
        { id: 'cpiIdeal' as const, label: 'CPI Ideal', description: 'Custo por initiate checkout ideal', prefix: 'R$' },
        { id: 'pvToIcMin' as const, label: 'PV → IC Mínimo', description: 'Taxa mínima de Page View para Initiate Checkout', suffix: '%' },
        { id: 'icToSaleMin' as const, label: 'IC → Venda Mínimo', description: 'Taxa mínima de Initiate Checkout para compra', suffix: '%' },
      ],
    },
  ]

  return (
    <PageShell className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pb-text">Configurações</h1>
          <p className="text-pb-muted text-sm mt-0.5">Regras do cérebro — parâmetros usados pelo diagnóstico IA</p>
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

      {/* Info */}
      <div className="bg-pb-card-alt border border-pb-border rounded-xl p-4 flex gap-3">
        <Settings className="h-4 w-4 text-pb-muted shrink-0 mt-0.5" />
        <p className="text-xs text-pb-muted leading-relaxed">
          Estes parâmetros são usados pelo diagnóstico IA para classificar campanhas como bom, atenção ou crítico.
          Ajuste conforme as metas do seu negócio.
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
