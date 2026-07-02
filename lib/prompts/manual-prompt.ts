import { SummaryMetrics } from '@/types/metrics'
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils'

export function buildManualPrompt(metrics: SummaryMetrics): string {
  const { overall: o, byCampaign, dateRange } = metrics
  const roi = o.spend > 0 ? (o.revenue - o.spend) / o.spend : 0

  const campaignLines = byCampaign
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10)
    .map(c =>
      `  - ${c.campaignName}\n` +
      `    Gasto: ${formatCurrency(c.spend)} | Receita: ${formatCurrency(c.revenue)} | ROAS: ${c.roas.toFixed(2)}x\n` +
      `    CPA: ${formatCurrency(c.cpa)} | CTR: ${formatPercent(c.ctr)} | CPC: ${formatCurrency(c.cpc)}\n` +
      `    Compras: ${c.purchases} | IC→Venda: ${formatPercent(c.checkoutToPurchaseRate)}`
    )
    .join('\n\n')

  return `# Prompt — Diagnóstico de Tráfego Pago (Pitbrain)

Você é um gestor de tráfego pago sênior especializado em Meta Ads.
Analise os dados abaixo e produza um diagnóstico estruturado por estágio de funil.

## REGRAS OBRIGATÓRIAS
- Use SOMENTE os dados fornecidos. Não invente nem suponha valores.
- Todos os valores já foram calculados — apenas interprete-os.
- Seja objetivo e direto. Sem frases genéricas.
- Retorne EXATAMENTE o JSON especificado no final, sem texto antes ou depois.
- Não inclua markdown ao redor do JSON (sem \`\`\`json).

## THRESHOLDS DE REFERÊNCIA
- ROAS: <1.5 = critico | 1.5–2.0 = atencao | >2.0 = bom
- ROI: <0% = critico | 0–15% = atencao | >15% = bom
- CTR: <1.5% = atencao | >2.0% = bom
- CPC: >R$5 = critico | R$3–5 = atencao | <R$3 = bom
- CPM: >R$90 = critico | R$60–90 = atencao | <R$60 = bom
- PV→IC/Add To Cart: <8% = critico | 8–12% = atencao | >12% = bom
- IC/Add To Cart→Venda: <15% = critico | 15–20% = atencao | >20% = bom

## DADOS DA CONTA (${dateRange.from} a ${dateRange.to})

### Métricas gerais
- Gasto total: ${formatCurrency(o.spend)}
- Receita total: ${formatCurrency(o.revenue)}
- ROAS: ${o.roas.toFixed(2)}x
- ROI: ${(roi * 100).toFixed(1)}%
- CPA: ${formatCurrency(o.cpa)}
- Lucro bruto: ${formatCurrency(o.revenue - o.spend)}

### Topo de funil
- Impressões: ${formatNumber(o.impressions, 0)}
- Cliques: ${formatNumber(o.clicks, 0)}
- CTR: ${formatPercent(o.ctr)}
- CPC: ${formatCurrency(o.cpc)}
- CPM: ${formatCurrency(o.cpm)}

### Meio de funil
- Page Views: ${formatNumber(o.pageViews, 0)}
- IC/Add To Cart: ${formatNumber(o.initiateCheckouts, 0)}
- Taxa PV→IC/Add To Cart: ${formatPercent(o.pageViewToCheckoutRate)}

### Fundo de funil
- Compras: ${formatNumber(o.purchases, 0)}
- Taxa IC/Add To Cart→Venda: ${formatPercent(o.checkoutToPurchaseRate)}

### Campanhas (top 10 por gasto)
${campaignLines || '  Sem dados de campanha desagregados.'}

## FORMATO DE RESPOSTA (JSON puro, sem markdown)
{
  "executiveSummary": "2-3 frases sobre o estado geral",
  "topFunnel": {
    "status": "bom | atencao | critico",
    "diagnosis": "análise do topo de funil",
    "evidence": ["CTR: valor — interpretação", "CPC: valor — interpretação"],
    "actions": ["ação concreta 1", "ação concreta 2"]
  },
  "middleFunnel": {
    "status": "bom | atencao | critico",
    "diagnosis": "análise do meio de funil",
    "evidence": ["PV→IC: valor — interpretação"],
    "actions": ["ação concreta 1"]
  },
  "bottomFunnel": {
    "status": "bom | atencao | critico",
    "diagnosis": "análise do fundo de funil",
    "evidence": ["ROAS: valor — interpretação", "IC→Venda: valor — interpretação"],
    "actions": ["ação concreta 1", "ação concreta 2"]
  },
  "mainBottleneck": "onde está o maior gargalo e por quê",
  "recommendedActions": [
    {
      "action": "ação específica e executável",
      "reason": "por que resolve o problema",
      "priority": "alta | media | baixa",
      "risk": "baixo | medio | alto"
    }
  ],
  "testsForTomorrow": [
    {
      "test": "nome do teste",
      "hypothesis": "o que se espera que aconteça",
      "successMetric": "métrica e valor de sucesso em X dias"
    }
  ],
  "risks": ["risco operacional 1", "risco 2"],
  "nextDecision": "próxima decisão táctica mais importante"
}
`
}
