import { SummaryMetrics } from '@/types/metrics'
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils'

export function buildDiagnosisPrompt(metrics: SummaryMetrics): { system: string; user: string } {
  const { overall: o, byCampaign } = metrics

  const system = `Você é um gestor de tráfego pago sênior especializado em Meta Ads.
Analise as métricas fornecidas e produza um diagnóstico estruturado por estágio de funil.

REGRAS ABSOLUTAS:
- Use SOMENTE os dados fornecidos. Não invente nem suponha valores.
- Todos os valores já foram calculados — apenas interprete-os.
- Seja objetivo e direto. Sem frases genéricas ou de marketing.
- Retorne EXATAMENTE o JSON especificado, sem texto adicional, sem markdown.

THRESHOLDS DE REFERÊNCIA:
- ROAS: <1.5 = critico | 1.5-2.0 = atencao | >2.0 = bom
- ROI: <0% = critico | 0-15% = atencao | >15% = bom
- CTR: <1.5% = atencao | >2.0% = bom
- CPC: >R$5 = critico | R$3-5 = atencao | <R$3 = bom
- CPM: >R$90 = critico | R$60-90 = atencao | <R$60 = bom
- PV→IC/Add To Cart: <8% = critico | 8-12% = atencao | >12% = bom
- IC/Add To Cart→Venda: <15% = critico | 15-20% = atencao | >20% = bom

FORMATO DE RESPOSTA (JSON puro, sem markdown):
{
  "executiveSummary": "2-3 frases sobre o estado geral da operação",
  "topFunnel": {
    "status": "bom | atencao | critico",
    "diagnosis": "análise de CTR, CPC, CPM e qualidade dos criativos",
    "evidence": ["métrica: valor — interpretação", "..."],
    "actions": ["ação concreta 1", "ação concreta 2"]
  },
  "middleFunnel": {
    "status": "bom | atencao | critico",
    "diagnosis": "análise da taxa page view → checkout e qualidade da página",
    "evidence": ["métrica: valor — interpretação", "..."],
    "actions": ["ação concreta 1", "ação concreta 2"]
  },
  "bottomFunnel": {
    "status": "bom | atencao | critico",
    "diagnosis": "análise de ROAS, ROI, CPA e taxa IC→Venda",
    "evidence": ["métrica: valor — interpretação", "..."],
    "actions": ["ação concreta 1", "ação concreta 2"]
  },
  "mainBottleneck": "descrição clara de onde está o maior gargalo e por quê",
  "recommendedActions": [
    {
      "action": "ação específica e executável",
      "reason": "por que esta ação resolve o problema identificado",
      "priority": "alta | media | baixa",
      "risk": "baixo | medio | alto"
    }
  ],
  "testsForTomorrow": [
    {
      "test": "nome do teste",
      "hypothesis": "o que se espera que aconteça e por quê",
      "successMetric": "métrica e valor que define sucesso em X dias"
    }
  ],
  "risks": ["risco operacional identificado 1", "risco 2"],
  "nextDecision": "próxima decisão táctica mais importante a tomar agora"
}`

  const campaignSummary = byCampaign
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 10)
    .map(c =>
      `- ${c.campaignName}: gasto=${formatCurrency(c.spend)}, receita=${formatCurrency(c.revenue)}, ROAS=${c.roas.toFixed(2)}, CPA=${formatCurrency(c.cpa)}, CTR=${formatPercent(c.ctr)}, CPC=${formatCurrency(c.cpc)}, compras=${c.purchases}, IC→Venda=${formatPercent(c.checkoutToPurchaseRate)}`
    )
    .join('\n')

  const user = `MÉTRICAS GERAIS (período: ${metrics.dateRange.from} a ${metrics.dateRange.to}):
Gasto total: ${formatCurrency(o.spend)}
Receita total: ${formatCurrency(o.revenue)}
ROAS: ${o.roas.toFixed(2)}x
ROI: ${o.spend > 0 ? (((o.revenue - o.spend) / o.spend) * 100).toFixed(1) : '0.0'}%
CPA: ${formatCurrency(o.cpa)}
Impressões: ${formatNumber(o.impressions, 0)}
Cliques: ${formatNumber(o.clicks, 0)}
CTR: ${formatPercent(o.ctr)}
CPC: ${formatCurrency(o.cpc)}
CPM: ${formatCurrency(o.cpm)}
Page Views: ${formatNumber(o.pageViews, 0)}
IC/Add To Cart: ${formatNumber(o.initiateCheckouts, 0)}
Compras: ${formatNumber(o.purchases, 0)}
Taxa PV→IC/Add To Cart: ${formatPercent(o.pageViewToCheckoutRate)}
Taxa IC/Add To Cart→Venda: ${formatPercent(o.checkoutToPurchaseRate)}

CAMPANHAS (top 10 por gasto):
${campaignSummary || 'Sem dados de campanha desagregados.'}

Produza o diagnóstico completo no formato JSON especificado.`

  return { system, user }
}
