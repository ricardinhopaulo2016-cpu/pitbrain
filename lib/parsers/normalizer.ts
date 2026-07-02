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
  add_to_cart: 'Add To Cart',
  hook: 'Hook Rate',
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

// Required columns for UTM breakdown mode (date is not applicable)
export const BREAKDOWN_EXPECTED_COLUMNS = ['purchases', 'spend', 'revenue']

// Page Views aliases — shared between orders mode (COLUMN_ALIASES) and
// daily/breakdown mode (DAILY_AGGREGATE_ALIASES) so both recognize UTMify's
// abbreviated Portuguese header ("VIS. DE PÁG.") the same way. Values are
// normalized (via `normalize()`) before comparison, so case/accents/punctuation
// don't need separate entries — e.g. "VIS. DE PÁG." and "Vis de pág" both
// normalize to "vis de pag".
const PAGE_VIEWS_ALIASES = [
  'page_views', 'pageviews', 'page views', 'page view', 'pv',
  'vis de pag', 'vis pag', 'vis de pagina', 'vis pagina',
  'visitas de pag', 'visitas de pagina', 'visitas de paginas', 'visitas',
  'visualizacoes', 'visualizacoes de pagina', 'visualizacoes da pagina',
  'visualizacoes de paginas', 'visualizacoes da paginas',
  'visualizacoes de pag', 'visualizacoes da pag',
  'views',
]

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
  page_views: PAGE_VIEWS_ALIASES,
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
  ic: ['ic', 'initiate checkout', 'initiate_checkout', 'initiate checkouts', 'initiate_checkouts', 'checkouts iniciados', 'inicio checkout', 'checkout iniciado', 'checkout'],
  cpi: ['cpi'],
  clicks: ['cliques', 'clicks'],
  impressions: ['impressoes', 'impressions', 'impr'],
  page_views: PAGE_VIEWS_ALIASES,
  add_to_cart: ['add to cart', 'add_to_cart', 'carrinho', 'adicionados ao carrinho', 'atc', 'add ao carrinho'],
  hook: ['hook', 'taxa de hook', 'hook rate'],
}

function normalize(str: string): string {
  return str
    .replace(/^﻿/, '') // strip UTF-8 BOM (most common cause of "Sem nome" / header mismatch)
    .replace(/\r?\n/g, ' ')
    .replace(/\t/g, ' ')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Use as papaparse `transformHeader` to strip BOM and normalize whitespace. */
export function cleanHeader(h: string): string {
  return h.replace(/^﻿/, '').replace(/\t/g, ' ').trim()
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

export function detectBreakdownMapping(headers: string[]): NormalizerResult {
  return buildMapping(headers, DAILY_AGGREGATE_ALIASES, BREAKDOWN_EXPECTED_COLUMNS)
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

// Returns true when the first column is a UTM dimension AND file has aggregate metrics.
// Must check FIRST column specifically to distinguish from orders files (which also have utm_ columns).
export function detectIsUtmBreakdown(headers: string[]): boolean {
  if (headers.length === 0) return false

  const firstNorm = normalize(headers[0])
  // Normalize handles underscores: 'UTM_CONTENT' → 'utm_content'
  const UTM_DIM_PATTERNS = [
    'utm_campaign', 'utm campaign',
    'utm_medium', 'utm medium',
    'utm_content', 'utm content',
    'utm_term', 'utm term',
    'utm_source', 'utm source',
  ]
  const firstIsUtmDim = UTM_DIM_PATTERNS.includes(firstNorm)
  if (!firstIsUtmDim) return false

  const normed = headers.map(h => normalize(h))
  return normed.some(h =>
    h === 'gastos' || h === 'faturamento' || h === 'vendas' || h === 'roas' || h === 'lucro'
  )
}

// ── Meta Ads file type detection ─────────────────────────────────────────────

// Columns only present in Meta Ads *structure* (not performance) exports
const META_STRUCTURE_ONLY_MARKERS = [
  'campaign status', 'status da campanha',
  'ad set run status', 'status de exibicao',
  'campaign objective', 'objetivo da campanha',
  'buying type', 'tipo de compra',
  'campaign daily budget', 'orcamento diario',
  'ad set daily budget',
  'story id',
  'creative type', 'tipo de criativo',
  'permalink',
  'video id',
  'video file name',
  'url tags', 'parametros de url', 'url parameters',
  'call to action', 'chamada para acao',
]

// Columns only present in Meta Ads *performance* exports
const META_PERFORMANCE_MARKERS = [
  'valor usado', 'amount spent', 'valor gasto',
  'impressoes', 'impressions',
]

/**
 * Returns true when headers belong to a Meta Ads structure export
 * (Campaign/AdSet/Ad hierarchy without performance metrics like spend/impressions).
 */
export function detectIsMetaStructure(headers: string[]): boolean {
  const normed = headers.map(h => normalize(h))

  // Presence of performance markers means it's a performance export, not structure
  const hasPerformance = META_PERFORMANCE_MARKERS.some(m =>
    normed.some(h => h === m || h.startsWith(m))
  )
  if (hasPerformance) return false

  // Presence of structure-only markers → definitely a structure export
  const hasStructureOnly = META_STRUCTURE_ONLY_MARKERS.some(m =>
    normed.some(h => h === m || h.includes(m))
  )
  if (hasStructureOnly) return true

  // Fallback: hierarchical columns present but NO performance columns
  const hasCampaignName = normed.some(h => h.includes('campaign name') || h.includes('nome da campanha'))
  const hasAdSetName   = normed.some(h => h === 'ad set name' || h.includes('ad set name') || h.includes('conjunto de an'))
  const hasAdName      = normed.some(h => h === 'ad name' || h.includes('anuncio'))
  const hasCampaignId  = normed.some(h => h === 'campaign id' || h.includes('campaign id') || h.includes('id da campanha'))

  return hasCampaignName && hasAdSetName && hasAdName && hasCampaignId
}
