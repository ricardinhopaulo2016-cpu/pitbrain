import type {
  MetaRawAdAccount,
  MetaRawCampaign,
  MetaRawAdset,
  MetaRawAd,
  MetaRawCreative,
  MetaRawInsight,
  MetaRawActionValue,
  MetaAdAccount,
  MetaCampaign,
  MetaAdset,
  MetaAd,
  MetaCreative,
  MetaInsight,
  MetaInsightLevel,
  MetaDarkPostAsset,
} from './meta-types'

function toNumberOrNull(value: string | undefined): number | null {
  if (value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

// Preference order for locating the "purchase" signal inside actions/action_values/
// cost_per_action_type arrays — Meta reports the same conversion under different
// action_type keys depending on pixel/CAPI/catalog setup.
const PURCHASE_ACTION_TYPES = ['purchase', 'offsite_conversion.fb_pixel_purchase', 'omni_purchase']

function findActionValue(list: MetaRawActionValue[] | undefined, actionTypes: string[]): number | null {
  if (!list) return null
  for (const type of actionTypes) {
    const match = list.find(a => a.action_type === type)
    if (match) return toNumberOrNull(match.value)
  }
  return null
}

// ── Ad account / campaign / adset / ad / creative ──────────────────────────────

export function normalizeAdAccount(raw: MetaRawAdAccount): MetaAdAccount {
  return {
    id: raw.id,
    accountId: raw.account_id,
    name: raw.name ?? raw.id,
    currency: raw.currency,
    timezoneName: raw.timezone_name,
    accountStatus: raw.account_status,
  }
}

export function normalizeCampaign(raw: MetaRawCampaign): MetaCampaign {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status,
    effectiveStatus: raw.effective_status,
    objective: raw.objective,
    buyingType: raw.buying_type,
    dailyBudget: toNumberOrNull(raw.daily_budget),
    lifetimeBudget: toNumberOrNull(raw.lifetime_budget),
    bidStrategy: raw.bid_strategy,
    createdTime: raw.created_time,
    updatedTime: raw.updated_time,
    startTime: raw.start_time,
    stopTime: raw.stop_time,
  }
}

export function normalizeAdset(raw: MetaRawAdset): MetaAdset {
  return {
    id: raw.id,
    name: raw.name,
    campaignId: raw.campaign_id,
    status: raw.status,
    effectiveStatus: raw.effective_status,
    dailyBudget: toNumberOrNull(raw.daily_budget),
    lifetimeBudget: toNumberOrNull(raw.lifetime_budget),
    optimizationGoal: raw.optimization_goal,
    billingEvent: raw.billing_event,
    bidAmount: toNumberOrNull(raw.bid_amount),
    targeting: raw.targeting,
    promotedObject: raw.promoted_object,
    createdTime: raw.created_time,
    updatedTime: raw.updated_time,
  }
}

export function normalizeAd(raw: MetaRawAd): MetaAd {
  return {
    id: raw.id,
    name: raw.name,
    campaignId: raw.campaign_id,
    adsetId: raw.adset_id,
    status: raw.status,
    effectiveStatus: raw.effective_status,
    creativeId: raw.creative?.id,
    createdTime: raw.created_time,
    updatedTime: raw.updated_time,
    previewShareableLink: raw.preview_shareable_link,
  }
}

export function normalizeCreative(raw: MetaRawCreative): MetaCreative {
  return {
    id: raw.id,
    name: raw.name,
    objectStoryId: raw.object_story_id,
    effectiveObjectStoryId: raw.effective_object_story_id,
    objectStorySpec: raw.object_story_spec,
    assetFeedSpec: raw.asset_feed_spec,
    callToActionType: raw.call_to_action_type,
    urlTags: raw.url_tags,
    body: raw.body,
    title: raw.title,
    imageUrl: raw.image_url,
    thumbnailUrl: raw.thumbnail_url,
    videoId: raw.video_id,
    instagramPermalinkUrl: raw.instagram_permalink_url,
    linkUrl: raw.link_url,
  }
}

// ── Insights ───────────────────────────────────────────────────────────────────

export function normalizeInsight(raw: MetaRawInsight, level: MetaInsightLevel): MetaInsight {
  const entityId = (level === 'campaign' ? raw.campaign_id : level === 'adset' ? raw.adset_id : raw.ad_id) ?? ''
  const purchases = findActionValue(raw.actions, PURCHASE_ACTION_TYPES)
  // Revenue comes only from directly-reported action_values — purchase_roas is a ratio,
  // not a currency amount, so it is never used to derive purchaseValue (would be inventing data).
  const purchaseValue = findActionValue(raw.action_values, PURCHASE_ACTION_TYPES)
  const costPerPurchase = findActionValue(raw.cost_per_action_type, PURCHASE_ACTION_TYPES)

  const roasList = raw.purchase_roas ?? raw.website_purchase_roas
  const roas = roasList
    ? toNumberOrNull(roasList.find(r => PURCHASE_ACTION_TYPES.includes(r.action_type))?.value ?? roasList[0]?.value)
    : null

  return {
    entityLevel: level,
    entityId,
    dateStart: raw.date_start,
    dateStop: raw.date_stop,
    spend: toNumberOrNull(raw.spend) ?? 0,
    impressions: toNumberOrNull(raw.impressions) ?? 0,
    clicks: toNumberOrNull(raw.clicks) ?? 0,
    cpc: toNumberOrNull(raw.cpc),
    cpm: toNumberOrNull(raw.cpm),
    ctr: toNumberOrNull(raw.ctr),
    purchases,
    purchaseValue,
    costPerPurchase,
    roas,
  }
}

// ── Dark post / post ID extraction ─────────────────────────────────────────────

/**
 * Read-only extraction — never mutates the ad/creative passed in.
 * object_story_id is commonly formatted as `{pageId}_{postId}`; when it isn't
 * (a bare numeric id), pageId/postId are left undefined for later inference.
 */
export function extractDarkPostAsset(
  ad: MetaAd,
  creative: MetaCreative | undefined,
  campaign: MetaCampaign | undefined,
  adset: MetaAdset | undefined,
  extractedAt: string = new Date().toISOString()
): MetaDarkPostAsset {
  const objectStoryId = creative?.objectStoryId
  const effectiveObjectStoryId = creative?.effectiveObjectStoryId

  const storyIdToSplit = objectStoryId ?? effectiveObjectStoryId
  let pageId: string | undefined
  let postId: string | undefined

  if (storyIdToSplit && storyIdToSplit.includes('_')) {
    const [page, post] = storyIdToSplit.split('_')
    pageId = page
    postId = post
  }

  const videoId = creative?.videoId
  const permalink = creative?.instagramPermalinkUrl

  const darkPostReady = Boolean(objectStoryId || effectiveObjectStoryId || videoId || permalink)

  return {
    adId: ad.id,
    adName: ad.name,
    campaignId: ad.campaignId,
    campaignName: campaign?.name ?? '',
    adsetId: ad.adsetId,
    adsetName: adset?.name ?? '',
    creativeId: creative?.id ?? '',
    objectStoryId,
    effectiveObjectStoryId,
    postId,
    pageId,
    videoId,
    permalink,
    urlTags: creative?.urlTags,
    linkUrl: creative?.linkUrl,
    body: creative?.body,
    callToAction: creative?.callToActionType,
    status: ad.effectiveStatus ?? ad.status,
    darkPostReady,
    extractedAt,
  }
}
