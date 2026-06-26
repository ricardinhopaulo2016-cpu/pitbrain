export interface MetaRawRow {
  campaign_name?: string
  campaign_id?: string
  adset_name?: string
  adset_id?: string
  ad_name?: string
  ad_id?: string
  date_start?: string
  date_stop?: string
  spend?: string
  impressions?: string
  clicks?: string
  reach?: string
  cpm?: string
  cpc?: string
  ctr?: string
  cpp?: string
  frequency?: string
  actions?: string
  cost_per_action_type?: string
  // purchase
  purchase_roas?: string
  // Meta exports these as action breakdown columns
  [key: string]: string | undefined
}

export interface MetaCampaign {
  campaignId: string
  campaignName: string
  adsetName: string
  adsetId: string
  adName: string
  adId: string
  dateStart: string
  dateStop: string
  spend: number
  impressions: number
  clicks: number
  reach: number
  cpm: number
  cpc: number
  ctr: number
  purchases: number
  purchaseValue: number
  initiateCheckouts: number
  addToCarts: number
  landingPageViews: number
}
