import { SummaryMetrics } from '@/types/metrics'
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils'

export function buildDiagnosisPrompt(metrics: SummaryMetrics): { system: string; user: string } {
  const { overall, byCampaign } = metrics

  const system = `Você é um especialista em tráfego pago com foco em Meta Ads.
Você analisa métricas calculadas de campanhas e produz diagnósticos estruturados por estágio de funil.

REGRAS ABSOLUTAS:
- Use SOMENTE os dados fornecidos. Não invente métricas nem suponha valores.
- Calcule nada: todos os valores já foram calculados. Interprete-os.
- Separe o diagnóstico em topo, meio e fundo de funil.
- Seja objetivo. Evite textos genéricos.
- Retorne EXATAMENTE o JSON especificado, sem campos extras.

FORMATO DE RESPOSTA (JSON puro):
{
  "executiveSummary": "string — 2-3 frases sobre o estado geral",
  "topFunnel": {
    "diagnosis": "string — análise de impressões, alcance, CTR, CPM, CPC",
    "score": "bom | atenção | crítico",
    "keyMetrics": ["array de métricas relevantes mencionadas"]
  },
  "midFunnel": {
    "diagnosis": "string — análise de page views, taxa page view → checkout",
    "score": "bom | atenção | crítico",
    "keyMetrics": ["array de métricas relevantes mencionadas"]
  },
  "bottomFunnel": {
    "diagnosis": "string — análise de checkout → compra, CPA, ROAS",
    "score": "bom | atenção | crítico",
    "keyMetrics": ["array de métricas relevantes mencionadas"]
  },
  "mainBottleneck": "string — onde está o maior gargalo e por quê",
  "goodCampaigns": ["lista de nomes de campanhas com bom desempenho"],
  "badCampaigns": ["lista de nomes de campanhas com mau desempenho"],
  "recommendedActions": ["lista de 3-5 ações concretas, baseadas nos dados"],
  "testsForTomorrow": ["lista de 2-3 testes rápidos para executar"],
  "risks": ["lista de 2-3 riscos identificados nos dados"]
}`

  const o = overall
  const campaignSummary = byCampaign
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10)
    .map(c => `- ${c.campaignName}: gasto=${formatCurrency(c.spend)}, receita=${formatCurrency(c.revenue)}, ROAS=${formatNumber(c.roas)}, CPA=${formatCurrency(c.cpa)}, CTR=${formatPercent(c.ctr)}, CPC=${formatCurrency(c.cpc)}, compras=${c.purchases}, checkout→compra=${formatPercent(c.checkoutToPurchaseRate)}`)
    .join('\n')

  const user = `MÉTRICAS GERAIS (período: ${metrics.dateRange.from} a ${metrics.dateRange.to}):
Gasto total: ${formatCurrency(o.spend)}
Receita total: ${formatCurrency(o.revenue)}
ROAS: ${formatNumber(o.roas)}
CPA: ${formatCurrency(o.cpa)}
Impressões: ${formatNumber(o.impressions, 0)}
Alcance: ${formatNumber(o.reach, 0)}
Cliques: ${formatNumber(o.clicks, 0)}
CTR: ${formatPercent(o.ctr)}
CPC: ${formatCurrency(o.cpc)}
CPM: ${formatCurrency(o.cpm)}
Page Views: ${formatNumber(o.pageViews, 0)}
Checkouts iniciados: ${formatNumber(o.initiateCheckouts, 0)}
Compras: ${formatNumber(o.purchases, 0)}
Taxa clique→compra: ${formatPercent(o.clickToPurchaseRate)}
Taxa page view→checkout: ${formatPercent(o.pageViewToCheckoutRate)}
Taxa checkout→compra: ${formatPercent(o.checkoutToPurchaseRate)}

CAMPANHAS (top 10 por gasto):
${campaignSummary}

Produza o diagnóstico completo no formato JSON especificado.`

  return { system, user }
}
