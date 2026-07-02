import type { AIProvider } from './provider'
import type { SummaryMetrics } from '@/types/metrics'
import type {
  DiagnosisResponse,
  DiagnosisStatus,
  FunnelDiagnosis,
  RecommendedAction,
  TestForTomorrow,
} from '@/types/diagnosis'
import { formatCurrency, formatPercent, formatNumber } from '@/lib/utils'

// ── Scoring rules (per design spec) ────────────────────────────────────────
function scoreRoas(v: number): DiagnosisStatus {
  return v < 1.5 ? 'critico' : v < 2 ? 'atencao' : 'bom'
}
function scoreRoi(v: number): DiagnosisStatus {
  return v < 0 ? 'critico' : v < 0.15 ? 'atencao' : 'bom'
}
function scoreCtr(v: number): DiagnosisStatus {
  return v < 0.015 ? 'atencao' : 'bom'
}
function scoreCpc(v: number): DiagnosisStatus {
  return v > 5 ? 'critico' : v > 3 ? 'atencao' : 'bom'
}
function scoreCpm(v: number): DiagnosisStatus {
  return v > 90 ? 'critico' : v > 60 ? 'atencao' : 'bom'
}
function scorePvIc(v: number): DiagnosisStatus {
  return v < 0.08 ? 'critico' : v < 0.12 ? 'atencao' : 'bom'
}
function scoreIcVenda(v: number): DiagnosisStatus {
  return v < 0.15 ? 'critico' : v < 0.20 ? 'atencao' : 'bom'
}

function worst(...ss: DiagnosisStatus[]): DiagnosisStatus {
  if (ss.includes('critico')) return 'critico'
  if (ss.includes('atencao')) return 'atencao'
  return 'bom'
}

function pct(v: number) { return (v * 100).toFixed(2) + '%' }
function n2(v: number)  { return v.toFixed(2) }

export class MockProvider implements AIProvider {
  readonly providerName = 'mock'
  readonly modelName    = 'regras-locais-v1'

  async analyzePerformance(metrics: SummaryMetrics): Promise<DiagnosisResponse> {
    await new Promise(r => setTimeout(r, 700))

    const o   = metrics.overall
    const roi = o.spend > 0 ? (o.revenue - o.spend) / o.spend : 0

    // ── Funnel statuses ───────────────────────────────────────────────────
    const topStatus    = worst(scoreCtr(o.ctr), scoreCpc(o.cpc), scoreCpm(o.cpm))
    const middleStatus = scorePvIc(o.pageViewToCheckoutRate)
    const bottomStatus = worst(scoreIcVenda(o.checkoutToPurchaseRate), scoreRoas(o.roas), scoreRoi(roi))

    // ── Top funnel ────────────────────────────────────────────────────────
    const topFunnel: FunnelDiagnosis = {
      status: topStatus,
      diagnosis: buildTopDiagnosis(o.ctr, o.cpc, o.cpm),
      evidence: [
        `CTR: ${pct(o.ctr)} — referência bom ≥2.0%, atenção <1.5%`,
        `CPC: ${formatCurrency(o.cpc)} — referência bom ≤R$3, crítico >R$5`,
        `CPM: ${formatCurrency(o.cpm)} — referência bom ≤R$60, crítico >R$90`,
        `Impressões: ${formatNumber(o.impressions, 0)} | Cliques: ${formatNumber(o.clicks, 0)}`,
      ],
      actions: buildTopActions(o.ctr, o.cpc, o.cpm),
    }

    // ── Middle funnel ─────────────────────────────────────────────────────
    const middleFunnel: FunnelDiagnosis = {
      status: middleStatus,
      diagnosis: buildMiddleDiagnosis(o.pageViewToCheckoutRate, o.pageViews, o.initiateCheckouts),
      evidence: [
        `PV→IC/Add To Cart: ${pct(o.pageViewToCheckoutRate)} — referência bom ≥12%, crítico <8%`,
        `Page Views: ${formatNumber(o.pageViews, 0)}`,
        `IC/Add To Cart: ${formatNumber(o.initiateCheckouts, 0)}`,
      ],
      actions: buildMiddleActions(o.pageViewToCheckoutRate),
    }

    // ── Bottom funnel ─────────────────────────────────────────────────────
    const bottomFunnel: FunnelDiagnosis = {
      status: bottomStatus,
      diagnosis: buildBottomDiagnosis(o.roas, roi, o.checkoutToPurchaseRate),
      evidence: [
        `ROAS: ${n2(o.roas)}x — referência bom ≥2.0, crítico <1.5`,
        `ROI: ${pct(roi)} — referência bom ≥15%, crítico <0%`,
        `IC/Add To Cart→Venda: ${pct(o.checkoutToPurchaseRate)} — referência bom ≥20%, crítico <15%`,
        `CPA: ${formatCurrency(o.cpa)} | Vendas: ${o.purchases} | Gasto: ${formatCurrency(o.spend)}`,
      ],
      actions: buildBottomActions(o.roas, roi, o.checkoutToPurchaseRate),
    }

    // ── Main bottleneck ───────────────────────────────────────────────────
    const mainBottleneck = detectBottleneck(o, roi)

    // ── Recommended actions ───────────────────────────────────────────────
    const recommendedActions: RecommendedAction[] = buildRecommendedActions(
      o, roi, topStatus, middleStatus, bottomStatus
    )

    // ── Tests for tomorrow ────────────────────────────────────────────────
    const testsForTomorrow: TestForTomorrow[] = buildTests(o)

    // ── Risks ─────────────────────────────────────────────────────────────
    const risks = buildRisks(o, roi)

    // ── Next decision ─────────────────────────────────────────────────────
    const nextDecision = buildNextDecision(o, roi)

    // ── Executive summary ─────────────────────────────────────────────────
    const executiveSummary = buildSummary(o, roi, topStatus, middleStatus, bottomStatus, mainBottleneck)

    return {
      executiveSummary,
      topFunnel,
      middleFunnel,
      bottomFunnel,
      mainBottleneck,
      recommendedActions,
      testsForTomorrow,
      risks,
      nextDecision,
    }
  }
}

// ── Helper builders ──────────────────────────────────────────────────────────

function buildTopDiagnosis(ctr: number, cpc: number, cpm: number): string {
  const issues: string[] = []
  if (ctr < 0.015) issues.push(`CTR de ${pct(ctr)} abaixo do mínimo operacional de 1.5% — criativos com baixa relevância ou público saturado`)
  if (cpc > 5)     issues.push(`CPC de ${formatCurrency(cpc)} em nível crítico — indicativo de leilão competitivo ou segmentação ampla demais`)
  else if (cpc > 3) issues.push(`CPC de ${formatCurrency(cpc)} em atenção — monitorar tendência`)
  if (cpm > 90)    issues.push(`CPM de ${formatCurrency(cpm)} crítico — custo de alcance elevado para o segmento`)
  else if (cpm > 60) issues.push(`CPM de ${formatCurrency(cpm)} em atenção — avaliar troca de posicionamento`)

  if (issues.length === 0) {
    return `Topo de funil saudável: CTR ${pct(ctr)}, CPC ${formatCurrency(cpc)}, CPM ${formatCurrency(cpm)}. Os criativos estão atraindo cliques a custo adequado.`
  }
  return issues.join('. ') + '.'
}

function buildTopActions(ctr: number, cpc: number, cpm: number): string[] {
  const actions: string[] = []
  if (ctr < 0.015) {
    actions.push('Testar 3 novos criativos com ângulos diferentes: dor, resultado e prova social')
    actions.push('Revisar relevância do anúncio no diagnóstico de qualidade da Meta')
  }
  if (cpc > 3) {
    actions.push('Estreitar segmentação por interesses ou testar público lookalike 1%')
  }
  if (cpm > 60) {
    actions.push('Testar posicionamento automático vs. somente Feed para comparar CPM')
  }
  if (actions.length === 0) {
    actions.push('Manter estrutura atual e monitorar saturação dos criativos semanalmente')
  }
  return actions
}

function buildMiddleDiagnosis(pvIc: number, pageViews: number, checkouts: number): string {
  if (pageViews === 0) {
    return 'Sem dados de Page Views — verifique se o pixel está instalado e disparando corretamente na página de destino.'
  }
  if (pvIc < 0.08) {
    return `Taxa PV→IC/Add To Cart de ${pct(pvIc)} está crítica (${formatNumber(pageViews, 0)} PV para ${formatNumber(checkouts, 0)} IC/Add To Cart). A página de destino não está convertendo visitantes em intenção de compra — problema de copy, oferta ou carregamento.`
  }
  if (pvIc < 0.12) {
    return `Taxa PV→IC/Add To Cart de ${pct(pvIc)} em atenção. ${formatNumber(pageViews, 0)} page views geraram ${formatNumber(checkouts, 0)} IC/Add To Cart. Há espaço para otimizar a proposta de valor acima do fold.`
  }
  return `Meio de funil saudável: taxa PV→IC/Add To Cart de ${pct(pvIc)} — ${formatNumber(pageViews, 0)} page views convertendo bem em ${formatNumber(checkouts, 0)} IC/Add To Cart.`
}

function buildMiddleActions(pvIc: number): string[] {
  if (pvIc < 0.08) {
    return [
      'Auditar velocidade de carregamento da página (meta: <3s)',
      'Revisar proposta de valor: o benefício principal aparece nos primeiros 3 segundos?',
      'Testar headline A/B: benefício direto vs. resolução de dor',
      'Verificar se o pixel de Page View e InitiateCheckout estão disparando na ordem correta',
    ]
  }
  if (pvIc < 0.12) {
    return [
      'Adicionar prova social (depoimentos, contagem de compradores) acima do CTA',
      'Testar variação do CTA principal com urgência ou escassez',
    ]
  }
  return ['Manter estrutura atual da página de destino e monitorar taxa semanalmente']
}

function buildBottomDiagnosis(roas: number, roi: number, icVenda: number): string {
  const parts: string[] = []
  if (roas < 1.5) {
    parts.push(`ROAS de ${n2(roas)}x está ${roas < 1 ? 'abaixo do break-even' : 'crítico'} — cada R$1 investido retorna apenas R$${n2(roas)}`)
  }
  if (roi < 0) {
    parts.push(`ROI negativo de ${pct(roi)} — operação no prejuízo`)
  }
  if (icVenda < 0.15) {
    parts.push(`Taxa IC/Add To Cart→Venda de ${pct(icVenda)} crítica — checkout perdendo mais de 85% dos interessados`)
  } else if (icVenda < 0.20) {
    parts.push(`Taxa IC/Add To Cart→Venda de ${pct(icVenda)} em atenção — checkout com fricção moderada`)
  }

  if (parts.length === 0) {
    return `Fundo de funil saudável: ROAS ${n2(roas)}x, ROI ${pct(roi)}, IC/Add To Cart→Venda ${pct(icVenda)}. A operação está gerando retorno acima do mínimo operacional.`
  }
  return parts.join('. ') + '.'
}

function buildBottomActions(roas: number, roi: number, icVenda: number): string[] {
  const actions: string[] = []
  if (icVenda < 0.20) {
    actions.push('Auditar o checkout: remover campos desnecessários e verificar opções de pagamento')
    actions.push('Testar oferta de frete grátis ou parcelamento sem juros para reduzir abandono')
  }
  if (roas < 1.5) {
    actions.push('Revisar oferta principal: preço, garantia e diferenciais competitivos')
    actions.push('Pausar campanhas com ROAS < 1.0x e realocar budget para as melhores')
  }
  if (roi < 0.15 && roi >= 0) {
    actions.push('Analisar margem do produto — ROAS de break-even pode estar acima de 2x dependendo dos custos')
  }
  if (actions.length === 0) {
    actions.push('Considerar testar escala de 20% no budget das campanhas acima de 3x ROAS')
  }
  return actions
}

function detectBottleneck(
  o: SummaryMetrics['overall'],
  roi: number
): string {
  if (o.roas < 1) {
    return `ROAS de ${n2(o.roas)}x abaixo do break-even — a operação está no prejuízo. Prioridade máxima: revisão de oferta, checkout e alocação de budget antes de qualquer escala.`
  }
  if (o.pageViewToCheckoutRate < 0.08) {
    return `Meio de funil: taxa PV→IC/Add To Cart de ${pct(o.pageViewToCheckoutRate)} crítica. A página de destino não está convertendo tráfego em intenção de compra — foco em copy, velocidade e proposta de valor.`
  }
  if (o.checkoutToPurchaseRate < 0.15) {
    return `Fundo de funil: taxa IC/Add To Cart→Venda de ${pct(o.checkoutToPurchaseRate)} crítica. O checkout está perdendo a maioria dos interessados — verificar fluxo de pagamento, boleto e parcelas.`
  }
  if (o.ctr < 0.015) {
    return `Topo de funil: CTR de ${pct(o.ctr)} abaixo do mínimo. Os criativos não estão gerando engajamento suficiente — renovação de criativos é a ação prioritária.`
  }
  if (roi < 0) {
    return `ROI negativo de ${pct(roi)} — revisar estrutura de custos e margem do produto antes de escalar.`
  }
  return `Sem gargalo crítico identificado pelas regras automáticas. ROAS ${n2(o.roas)}x, IC/Add To Cart→Venda ${pct(o.checkoutToPurchaseRate)}, CTR ${pct(o.ctr)}. Recomenda-se diagnóstico via IA para insights mais profundos.`
}

function buildRecommendedActions(
  o: SummaryMetrics['overall'],
  roi: number,
  topStatus: DiagnosisStatus,
  middleStatus: DiagnosisStatus,
  bottomStatus: DiagnosisStatus,
): RecommendedAction[] {
  const actions: RecommendedAction[] = []

  if (o.roas < 1) {
    actions.push({
      action:   'Pausar campanhas com ROAS abaixo de 1.0x imediatamente',
      reason:   'Cada R$1 investido retorna menos de R$1 — queima de budget sem retorno',
      priority: 'alta',
      risk:     'baixo',
    })
  }

  if (bottomStatus !== 'bom') {
    actions.push({
      action:   'Auditar o checkout: campos, opções de pagamento e velocidade',
      reason:   `IC/Add To Cart→Venda de ${pct(o.checkoutToPurchaseRate)} indica fricção no fundo do funil`,
      priority: o.checkoutToPurchaseRate < 0.15 ? 'alta' : 'media',
      risk:     'baixo',
    })
  }

  if (middleStatus !== 'bom') {
    actions.push({
      action:   'Otimizar a página de destino: copy, CTA e velocidade de carregamento',
      reason:   `PV→IC/Add To Cart de ${pct(o.pageViewToCheckoutRate)} mostra que a maioria dos visitantes não inicia checkout`,
      priority: o.pageViewToCheckoutRate < 0.08 ? 'alta' : 'media',
      risk:     'baixo',
    })
  }

  if (topStatus !== 'bom') {
    actions.push({
      action:   'Renovar criativos com novos ângulos: dor, transformação e prova social',
      reason:   `CTR de ${pct(o.ctr)} e/ou CPC de ${formatCurrency(o.cpc)} indicam saturação ou baixa relevância`,
      priority: 'media',
      risk:     'baixo',
    })
  }

  if (o.roas >= 2 && roi >= 0.15) {
    actions.push({
      action:   'Escalar budget das melhores campanhas em 20% e monitorar por 3 dias',
      reason:   `ROAS ${n2(o.roas)}x e ROI ${pct(roi)} estão acima dos mínimos operacionais`,
      priority: 'media',
      risk:     'medio',
    })
  }

  if (actions.length === 0) {
    actions.push({
      action:   'Criar teste lookalike 1% baseado nos compradores dos últimos 30 dias',
      reason:   'Expansão de audiência similar a quem já comprou melhora o custo de aquisição',
      priority: 'baixa',
      risk:     'baixo',
    })
  }

  return actions.slice(0, 5)
}

function buildTests(o: SummaryMetrics['overall']): TestForTomorrow[] {
  const tests: TestForTomorrow[] = []

  if (o.ctr < 0.02) {
    tests.push({
      test:          'A/B de criativo: ângulo de dor vs. ângulo de resultado',
      hypothesis:    'Mudar o ângulo da headline aumenta a relevância e o CTR acima de 2%',
      successMetric: 'CTR ≥ 2.0% em 3 dias com CPC estável ou menor',
    })
  }

  tests.push({
    test:          'Teste de oferta: frete grátis vs. desconto de 10% no checkout',
    hypothesis:    'Reduzir a barreira percebida de compra aumenta a taxa IC→Venda',
    successMetric: `IC→Venda ≥ ${pct(o.checkoutToPurchaseRate * 1.2)} em 5 dias (alta de 20%)`,
  })

  tests.push({
    test:          'Lookalike 1% de compradores dos últimos 60 dias vs. público atual',
    hypothesis:    'Audiência mais similar a compradores reduz CPA e melhora ROAS',
    successMetric: `CPA menor que ${formatCurrency(o.cpa * 0.85)} com ROAS ≥ ${n2(Math.max(o.roas * 1.1, 2))}x`,
  })

  return tests
}

function buildRisks(o: SummaryMetrics['overall'], roi: number): string[] {
  const risks: string[] = []

  if (o.roas < 1.5) {
    risks.push(`Escalar budget com ROAS ${n2(o.roas)}x acelera o prejuízo — não aumentar investimento antes de estabilizar o fundo do funil`)
  }
  if (o.impressions > 0 && o.clicks / o.impressions < 0.015) {
    risks.push('Saturação de criativos — frequência alta sem renovação deteriora o CTR progressivamente')
  }
  if (o.checkoutToPurchaseRate < 0.15) {
    risks.push('Alto abandono no checkout pode indicar problema de confiança — verificar SSL, selos e reclamações no Reclame Aqui')
  }
  if (roi < 0) {
    risks.push(`ROI negativo — se a tendência se mantiver, o negócio opera no prejuízo; revisar precificação e margem`)
  }

  if (risks.length === 0) {
    risks.push('Saturação futura de público se a escala ultrapassar 3x o budget atual sem renovar criativos')
    risks.push('Sazonalidade — comparar com mesmo período do mês anterior para isolar tendência real')
  }

  return risks.slice(0, 4)
}

function buildNextDecision(o: SummaryMetrics['overall'], roi: number): string {
  if (o.roas < 1) {
    return `Pausar campanhas no prejuízo e redirecionar budget para as que têm ROAS ≥ 1.5x. Não escalar antes de corrigir o fundo do funil.`
  }
  if (o.checkoutToPurchaseRate < 0.15) {
    return `Prioridade: auditar e corrigir o checkout antes de qualquer outra ação. Cada ponto percentual a mais na taxa IC/Add To Cart→Venda tem impacto direto no CPA.`
  }
  if (o.pageViewToCheckoutRate < 0.08) {
    return `Prioridade: otimizar a página de destino. Aumentar a taxa PV→IC/Add To Cart de ${pct(o.pageViewToCheckoutRate)} para pelo menos 10% pode dobrar as vendas sem aumentar o budget.`
  }
  if (o.roas >= 2 && roi >= 0.15) {
    return `Operação em zona positiva. Próximo passo: teste de escala controlado (+20% budget nas melhores campanhas) monitorando ROAS diariamente por 3 dias.`
  }
  return `Realizar diagnóstico via IA com prompt completo para obter insights aprofundados sobre os dados desta conta.`
}

function buildSummary(
  o: SummaryMetrics['overall'],
  roi: number,
  top: DiagnosisStatus,
  mid: DiagnosisStatus,
  bot: DiagnosisStatus,
  bottleneck: string,
): string {
  const statusPt = { bom: 'saudável', atencao: 'em atenção', critico: 'crítico' }
  return `Diagnóstico local por regras — ROAS ${n2(o.roas)}x, ROI ${pct(roi)}, CPA ${formatCurrency(o.cpa)}. Topo de funil ${statusPt[top]}, meio ${statusPt[mid]}, fundo ${statusPt[bot]}. ${bottleneck}`
}
