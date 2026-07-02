// ── Graph API raw response shapes (server-side only) ──────────────────────────
// Loosely typed — the Marketing API returns many more fields than we use;
// only the ones this integration reads are declared explicitly.

export interface MetaPaging {
  cursors?: { before?: string; after?: string }
  next?: string
  previous?: string
}

export interface MetaListResponse<T> {
  data: T[]
  paging?: MetaPaging
}

export interface MetaRawAdAccount {
  id: string
  account_id?: string
  name?: string
  currency?: string
  timezone_name?: string
  account_status?: number
}

export interface MetaRawCampaign {
  id: string
  name: string
  status: string
  effective_status?: string
  objective?: string
  buying_type?: string
  daily_budget?: string
  lifetime_budget?: string
  bid_strategy?: string
  created_time?: string
  updated_time?: string
  start_time?: string
  stop_time?: string
}

export interface MetaRawAdset {
  id: string
  name: string
  campaign_id: string
  status: string
  effective_status?: string
  daily_budget?: string
  lifetime_budget?: string
  optimization_goal?: string
  billing_event?: string
  bid_amount?: string
  targeting?: Record<string, unknown>
  promoted_object?: Record<string, unknown>
  created_time?: string
  updated_time?: string
}

export interface MetaRawAd {
  id: string
  name: string
  campaign_id: string
  adset_id: string
  status: string
  effective_status?: string
  creative?: { id: string }
  created_time?: string
  updated_time?: string
  preview_shareable_link?: string
}

export interface MetaRawCreative {
  id: string
  name?: string
  object_story_id?: string
  effective_object_story_id?: string
  object_story_spec?: Record<string, unknown>
  asset_feed_spec?: Record<string, unknown>
  call_to_action_type?: string
  url_tags?: string
  body?: string
  title?: string
  image_url?: string
  thumbnail_url?: string
  video_id?: string
  instagram_permalink_url?: string
  link_url?: string
}

export interface MetaRawActionValue {
  action_type: string
  value: string
}

export interface MetaRawPurchaseRoas {
  action_type: string
  value: string
}

export interface MetaRawInsight {
  campaign_id?: string
  adset_id?: string
  ad_id?: string
  date_start: string
  date_stop: string
  spend?: string
  impressions?: string
  clicks?: string
  cpc?: string
  cpm?: string
  ctr?: string
  actions?: MetaRawActionValue[]
  action_values?: MetaRawActionValue[]
  cost_per_action_type?: MetaRawActionValue[]
  purchase_roas?: MetaRawPurchaseRoas[]
  website_purchase_roas?: MetaRawPurchaseRoas[]
}

// ── Normalized domain types ────────────────────────────────────────────────────

export interface MetaAdAccount {
  id: string
  accountId?: string
  name: string
  currency?: string
  timezoneName?: string
  accountStatus?: number
}

export interface MetaCampaign {
  id: string
  name: string
  status: string
  effectiveStatus?: string
  objective?: string
  buyingType?: string
  dailyBudget?: number | null
  lifetimeBudget?: number | null
  bidStrategy?: string
  createdTime?: string
  updatedTime?: string
  startTime?: string
  stopTime?: string
}

export interface MetaAdset {
  id: string
  name: string
  campaignId: string
  status: string
  effectiveStatus?: string
  dailyBudget?: number | null
  lifetimeBudget?: number | null
  optimizationGoal?: string
  billingEvent?: string
  bidAmount?: number | null
  targeting?: Record<string, unknown>
  promotedObject?: Record<string, unknown>
  createdTime?: string
  updatedTime?: string
}

export interface MetaAd {
  id: string
  name: string
  campaignId: string
  adsetId: string
  status: string
  effectiveStatus?: string
  creativeId?: string
  createdTime?: string
  updatedTime?: string
  previewShareableLink?: string
}

export interface MetaCreative {
  id: string
  name?: string
  objectStoryId?: string
  effectiveObjectStoryId?: string
  objectStorySpec?: Record<string, unknown>
  assetFeedSpec?: Record<string, unknown>
  callToActionType?: string
  urlTags?: string
  body?: string
  title?: string
  imageUrl?: string
  thumbnailUrl?: string
  videoId?: string
  instagramPermalinkUrl?: string
  linkUrl?: string
}

export type MetaInsightLevel = 'campaign' | 'adset' | 'ad'

export interface MetaInsight {
  entityLevel: MetaInsightLevel
  entityId: string
  dateStart: string
  dateStop: string
  spend: number
  impressions: number
  clicks: number
  cpc: number | null
  cpm: number | null
  ctr: number | null
  purchases: number | null
  purchaseValue: number | null
  costPerPurchase: number | null
  roas: number | null
}

export interface MetaDarkPostAsset {
  adId: string
  adName: string
  campaignId: string
  campaignName: string
  adsetId: string
  adsetName: string
  creativeId: string
  objectStoryId?: string
  effectiveObjectStoryId?: string
  postId?: string
  pageId?: string
  videoId?: string
  permalink?: string
  urlTags?: string
  linkUrl?: string
  body?: string
  callToAction?: string
  status: string
  darkPostReady: boolean
  extractedAt: string
}

export interface MetaSyncResult {
  adAccountId: string
  syncedAt: string
  campaigns: MetaCampaign[]
  adsets: MetaAdset[]
  ads: MetaAd[]
  creatives: MetaCreative[]
  darkPosts: MetaDarkPostAsset[]
  counts: {
    campaigns: number
    adsets: number
    ads: number
    creatives: number
    darkPosts: number
  }
}
