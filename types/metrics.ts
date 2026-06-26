export interface FunnelMetrics {
  spend: number
  revenue: number
  roas: number
  cpa: number
  ctr: number
  cpc: number
  cpm: number
  impressions: number
  clicks: number
  reach: number
  pageViews: number
  initiateCheckouts: number
  purchases: number
  // conversion rates
  clickToPurchaseRate: number
  pageViewToCheckoutRate: number
  checkoutToPurchaseRate: number
}

export interface CampaignMetrics extends FunnelMetrics {
  campaignId: string
  campaignName: string
  dateStart: string
  dateStop: string
}

export interface SummaryMetrics {
  overall: FunnelMetrics
  byCampaign: CampaignMetrics[]
  dateRange: { from: string; to: string }
  sessionId: string
}
