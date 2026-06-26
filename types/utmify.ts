export interface UtmifyRawRow {
  order_id?: string
  order_date?: string
  product_name?: string
  status?: string
  payment_method?: string
  gross_revenue?: string
  net_revenue?: string
  refunded?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  campaign_id?: string
  adset_id?: string
  ad_id?: string
  country?: string
  page_views?: string
  sessions?: string
  initiate_checkouts?: string
  [key: string]: string | undefined
}

export interface UtmifySession {
  orderId: string
  orderDate: string | null
  productName: string | null
  status: string
  paymentMethod: string | null
  grossRevenue: number
  netRevenue: number
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmTerm: string | null
  utmContent: string | null
  campaignId: string | null
  adsetId: string | null
  adId: string | null
  pageViews: number
  initiateCheckouts: number
  sourceType: 'utmify_orders'
}

export interface UtmifyDailyRow {
  date: string | null
  purchases: number
  spend: number
  revenue: number
  profit: number | null
  roas: number | null
  cpa: number | null
  cpc: number | null
  ctr: number | null
  cpm: number | null
  roi: number | null
  margin: number | null
  initiateCheckout: number | null
  cpi: number | null
  clicks: number | null
  impressions: number | null
  pageViews: number | null
  sourceType: 'utmify_daily_aggregate'
}

export type UtmifyParseResult =
  | {
      sourceType: 'utmify_orders'
      rows: UtmifySession[]
      missingColumns: string[]
      unmappedHeaders: string[]
    }
  | {
      sourceType: 'utmify_daily_aggregate'
      rows: UtmifyDailyRow[]
      missingColumns: string[]
      unmappedHeaders: string[]
    }
