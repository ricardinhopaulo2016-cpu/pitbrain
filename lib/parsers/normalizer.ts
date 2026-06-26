// Flexible column normalizer for UTMify CSVs.

export const COLUMN_LABELS: Record<string, string> = {
  order_id: 'ID do pedido',
  order_date: 'Data do pedido',
  product_name: 'Nome do produto',
  status: 'Status',
  payment_method: 'Método de pagamento',
  gross_revenue: 'Valor / Receita bruta',
  net_revenue: 'Receita líquida',
  utm_source: 'UTM Source',
  utm_medium: 'UTM Medium',
  utm_campaign: 'UTM Campaign',
  utm_term: 'UTM Term',
  utm_content: 'UTM Content',
  campaign_id: 'Campaign ID',
  adset_id: 'Adset ID',
  ad_id: 'Ad ID',
  page_views: 'Page Views',
  sessions: 'Sessões',
  initiate_checkouts: 'Checkouts iniciados',
}

export const DAILY_COLUMN_LABELS: Record<string, string> = {
  date: 'Data',
  purchases: 'Vendas',
  spend: 'Gastos',
  revenue: 'Faturamento',
  profit: 'Lucro',
  roas: 'ROAS',
  cpa: 'CPA',
  cpc: 'CPC',
  ctr: 'CTR',
  cpm: 'CPM',
  roi: 'ROI',
  margin: 'Margem',
  ic: 'IC (Initiate Checkout)',
  cpi: 'CPI',
  clicks: 'Cliques',
  impressions: 'Impressões',
  page_views: 'Vis. de pág.',
}

// Columns shown in the missing-columns alert for orders mode
export const EXPECTED_COLUMNS = [
  'order_date',
  'gross_revenue',
  'status',
  'product_name',
  'utm_source',
  'utm_campaign',
  'utm_content',
  'campaign_id',
  'adset_id',
  'ad_id',
]

// Required columns for daily aggregate mode
export const DAILY_EXPECTED_COLUMNS = ['date', 'purchases', 'spend', 'revenue']

const COLUMN_ALIASES: Record<string, string[]> = {
  order_id: [
    'order_id', 'id_pedido', 'id do pedido', 'pedido', 'order', 'numero_pedido',
    'numero do pedido', 'id', 'cod', 'codigo', 'codigo do pedido',
  ],
  order_date: [
    'order_date', 'data', 'data_pedido', 'data do pedido', 'date', 'data_compra',
    'data compra', 'created_at', 'purchase_date', 'dt', 'data_venda',
    'data venda', 'data_criacao', 'data criacao',
  ],
  product_name: [
    'product_name', 'produto', 'product', 'item', 'nome_produto', 'nome do produto',
    'nome', 'product name', 'item_name', 'descricao', 'descricao do produto',
  ],
  status: [
    'status', 'situacao', 'situacao do pedido', 'estado', 'state',
    'payment_status', 'status do pedido', 'status_pedido',
  ],
  payment_method: [
    'payment_method', 'metodo_pagamento', 'metodo de pagamento', 'payment method',
    'forma_pagamento', 'forma de pagamento', 'pagamento', 'payment',
  ],
  gross_revenue: [
    'gross_revenue', 'valor', 'receita_bruta', 'receita bruta', 'gross revenue',
    'revenue', 'amount', 'total', 'price', 'preco', 'valor_bruto', 'valor bruto',
    'gross', 'venda', 'valor da venda', 'valor total', 'valor_total',
    'receita', 'faturamento', 'faturamento_bruto',
  ],
  net_revenue: [
    'net_revenue', 'receita_liquida', 'receita liquida', 'net revenue',
    'net', 'valor_liquido', 'valor liquido', 'liquido',
  ],
  utm_source: [
    'utm_source', 'utmsource', 'utm source', 'source', 'origem', 'src', 'utm-source',
  ],
  utm_medium: [
    'utm_medium', 'utmmedium', 'utm medium', 'medium', 'midia', 'utm-medium',
  ],
  utm_campaign: [
    'utm_campaign', 'utmcampaign', 'utm campaign', 'campaign', 'campanha',
    'utm-campaign', 'campaign_name', 'nome da campanha',
  ],
  utm_term: [
    'utm_term', 'utmterm', 'utm term', 'term', 'termo', 'keyword', 'utm-term',
  ],
  utm_content: [
    'utm_content', 'utmcontent', 'utm content', 'content', 'conteudo',
    'utm-content', 'criativo', 'creative', 'ad_name', 'nome do anuncio',
  ],
  campaign_id: [
    'campaign_id', 'campaignid', 'campaign-id', 'id_campanha', 'id campanha',
    'id da campanha', 'campaign id', 'campaign_id_meta',
  ],
  adset_id: [
    'adset_id', 'adsetid', 'adset-id', 'ad_set_id', 'id_conjunto',
    'id conjunto', 'id do conjunto', 'conjunto_id', 'adgroup_id',
    'adset id', 'conjunto de anuncios id',
  ],
  ad_id: [
    'ad_id', 'adid', 'ad-id', 'id_anuncio', 'id anuncio', 'id do anuncio',
    'anuncio_id', 'ad id',
  ],
  page_views: [
    'page_views', 'pageviews', 'page views', 'visualizacoes', 'visualizacoes de pagina',
    'views', 'visitas', 'page view',
  ],
  sessions: [
    'sessions', 'sessoes', 'sessao', 'visitas_unicas', 'visitas unicas', 'sessoes unicas',
  ],
  initiate_checkouts: [
    'initiate_checkouts', 'initiate_checkout', 'initiate checkout', 'checkouts',
    'checkout', 'checkouts_iniciados', 'checkouts iniciados', 'inicio_checkout',
    'inicio checkout',
  ],
}

// Aliases for UTMify daily aggregate report columns
const DAILY_AGGREGATE_ALIASES: Record<string, string[]> = {
  date: ['data', 'dia', 'date', 'day'],
  purchases: ['vendas', 'purchases', 'conversoes', 'conversions', 'pedidos', 'orders', 'vendas aprovadas'],
  spend: ['gastos', 'spend', 'investimento', 'investment', 'custo', 'cost', 'valor investido', 'gasto'],
  revenue: ['faturamento', 'receita', 'revenue', 'receita bruta', 'gross revenue', 'fat'],
  profit: ['lucro', 'profit'],
  roas: ['roas'],
  cpa: ['cpa'],
  cpc: ['cpc'],
  ctr: ['ctr'],
  cpm: ['cpm'],
  roi: ['roi'],
  margin: ['margem', 'margin'],
  ic: ['ic', 'initiate checkout', 'initiate_checkout', 'checkouts iniciados', 'inicio checkout'],
  cpi: ['cpi'],
  clicks: ['cliques', 'clicks'],
  impressions: ['impressoes', 'impressions', 'impr'],
  page_views: ['vis de pag', 'vis pag', 'visualizacoes', 'page views', 'page_views', 'visitas de pagina'],
}

function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface NormalizerResult {
  /** canonical column name → actual CSV header */
  mapping: Record<string, string | null>
  /** expected columns absent from the file */
  missingColumns: string[]
  /** CSV headers that didn't match any canonical column */
  unmappedHeaders: string[]
}

function buildMapping(
  headers: string[],
  aliases: Record<string, string[]>,
  expectedCols: string[]
): NormalizerResult {
  const normalizedHeaders = headers.map(h => ({ original: h, normalized: normalize(h) }))
  const usedOriginals = new Set<string>()
  const mapping: Record<string, string | null> = {}

  for (const [canonical, aliasList] of Object.entries(aliases)) {
    let found: string | null = null

    // Pass 1 — exact match
    for (const alias of aliasList) {
      const target = normalize(alias)
      const hit = normalizedHeaders.find(
        h => !usedOriginals.has(h.original) && h.normalized === target
      )
      if (hit) { found = hit.original; usedOriginals.add(hit.original); break }
    }

    // Pass 2 — one contains the other
    if (!found) {
      for (const alias of aliasList) {
        const target = normalize(alias)
        if (target.length < 3) continue
        const hit = normalizedHeaders.find(h => {
          if (usedOriginals.has(h.original)) return false
          return h.normalized.includes(target) || target.includes(h.normalized)
        })
        if (hit) { found = hit.original; usedOriginals.add(hit.original); break }
      }
    }

    // Pass 3 — word-overlap
    if (!found) {
      for (const alias of aliasList) {
        const words = normalize(alias).split(' ').filter(w => w.length > 2)
        if (words.length === 0) continue
        const hit = normalizedHeaders.find(h => {
          if (usedOriginals.has(h.original)) return false
          return words.every(w => h.normalized.includes(w))
        })
        if (hit) { found = hit.original; usedOriginals.add(hit.original); break }
      }
    }

    mapping[canonical] = found
  }

  const missingColumns = expectedCols.filter(col => !mapping[col])
  const unmappedHeaders = normalizedHeaders
    .filter(h => !usedOriginals.has(h.original))
    .map(h => h.original)

  return { mapping, missingColumns, unmappedHeaders }
}

export function detectColumnMapping(headers: string[]): NormalizerResult {
  return buildMapping(headers, COLUMN_ALIASES, EXPECTED_COLUMNS)
}

export function detectDailyAggregateMapping(headers: string[]): NormalizerResult {
  return buildMapping(headers, DAILY_AGGREGATE_ALIASES, DAILY_EXPECTED_COLUMNS)
}

// Returns true when the file looks like a UTMify daily aggregate report.
export function detectIsDailyAggregate(headers: string[]): boolean {
  const MARKERS = ['vendas', 'gastos', 'faturamento', 'lucro', 'roas', 'margem', 'roi']
  const normalizedHeaders = headers.map(h => normalize(h))
  const hits = MARKERS.filter(marker =>
    normalizedHeaders.some(h => h === marker || h.includes(marker))
  )
  return hits.length >= 2
}
