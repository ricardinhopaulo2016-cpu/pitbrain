import { MetaCampaign } from '@/types/meta'
import { UtmifySession } from '@/types/utmify'
import { CampaignMetrics, FunnelMetrics, SummaryMetrics } from '@/types/metrics'
import { safeDiv } from '@/lib/utils'

const PAID_STATUSES = ['paid', 'pago', 'aprovado', 'approved', 'complete', 'completo']

function isPaidOrder(status: string): boolean {
  return PAID_STATUSES.includes(status.toLowerCase().trim())
}

function buildFunnelMetrics(
  spend: number,
  revenue: number,
  impressions: number,
  clicks: number,
  reach: number,
  pageViews: number,
  initiateCheckouts: number,
  purchases: number
): FunnelMetrics {
  return {
    spend,
    revenue,
    roas: safeDiv(revenue, spend),
    cpa: safeDiv(spend, purchases),
    ctr: safeDiv(clicks, impressions),
    cpc: safeDiv(spend, clicks),
    cpm: impressions > 0 ? safeDiv(spend, impressions) * 1000 : 0,
    impressions,
    clicks,
    reach,
    pageViews,
    initiateCheckouts,
    purchases,
    clickToPurchaseRate: safeDiv(purchases, clicks),
    pageViewToCheckoutRate: safeDiv(initiateCheckouts, pageViews),
    checkoutToPurchaseRate: safeDiv(purchases, initiateCheckouts),
  }
}

export function calculateMetrics(
  metaRows: MetaCampaign[],
  utmifyRows: UtmifySession[],
  sessionId: string
): SummaryMetrics {
  // Aggregate UTMify by campaign
  const utmByCampaign = new Map<string, { revenue: number; purchases: number; pageViews: number; checkouts: number }>()

  for (const session of utmifyRows) {
    const key = session.utmCampaign || '__unknown__'
    const current = utmByCampaign.get(key) ?? { revenue: 0, purchases: 0, pageViews: 0, checkouts: 0 }
    if (isPaidOrder(session.status)) {
      current.revenue += session.grossRevenue
      current.purchases += 1
    }
    current.pageViews += session.pageViews
    current.checkouts += session.initiateCheckouts
    utmByCampaign.set(key, current)
  }

  // Group Meta rows by campaign
  const metaByCampaign = new Map<string, MetaCampaign[]>()
  for (const row of metaRows) {
    const key = row.campaignName
    const existing = metaByCampaign.get(key) ?? []
    existing.push(row)
    metaByCampaign.set(key, existing)
  }

  const byCampaign: CampaignMetrics[] = []
  let totalSpend = 0
  let totalRevenue = 0
  let totalImpressions = 0
  let totalClicks = 0
  let totalReach = 0
  let totalPageViews = 0
  let totalCheckouts = 0
  let totalPurchases = 0

  for (const [campaignName, rows] of metaByCampaign.entries()) {
    const spend = rows.reduce((s, r) => s + r.spend, 0)
    const impressions = rows.reduce((s, r) => s + r.impressions, 0)
    const clicks = rows.reduce((s, r) => s + r.clicks, 0)
    const reach = rows.reduce((s, r) => s + r.reach, 0)
    const metaPurchases = rows.reduce((s, r) => s + r.purchases, 0)
    const metaCheckouts = rows.reduce((s, r) => s + r.initiateCheckouts, 0)
    const metaPageViews = rows.reduce((s, r) => s + r.landingPageViews, 0)
    const metaRevenue = rows.reduce((s, r) => s + r.purchaseValue, 0)

    // Prefer UTMify data for revenue/purchases when available
    const utm = utmByCampaign.get(campaignName)
    const revenue = utm ? utm.revenue : metaRevenue
    const purchases = utm ? utm.purchases : metaPurchases
    const pageViews = utm ? utm.pageViews : metaPageViews
    const checkouts = utm ? utm.checkouts : metaCheckouts

    const dateStart = rows[0]?.dateStart ?? ''
    const dateStop = rows[rows.length - 1]?.dateStop ?? ''

    const funnel = buildFunnelMetrics(spend, revenue, impressions, clicks, reach, pageViews, checkouts, purchases)

    byCampaign.push({
      campaignId: rows[0]?.campaignId ?? '',
      campaignName,
      dateStart,
      dateStop,
      ...funnel,
    })

    totalSpend += spend
    totalRevenue += revenue
    totalImpressions += impressions
    totalClicks += clicks
    totalReach += reach
    totalPageViews += pageViews
    totalCheckouts += checkouts
    totalPurchases += purchases
  }

  // If no Meta data but UTMify exists, aggregate UTMify totals
  if (metaRows.length === 0) {
    for (const session of utmifyRows) {
      if (isPaidOrder(session.status)) {
        totalRevenue += session.grossRevenue
        totalPurchases += 1
      }
      totalPageViews += session.pageViews
      totalCheckouts += session.initiateCheckouts
    }
  }

  const overall = buildFunnelMetrics(
    totalSpend, totalRevenue, totalImpressions, totalClicks,
    totalReach, totalPageViews, totalCheckouts, totalPurchases
  )

  const allDates = metaRows.map(r => r.dateStart).filter(Boolean).sort()
  const dateRange = {
    from: allDates[0] ?? '',
    to: allDates[allDates.length - 1] ?? '',
  }

  return { overall, byCampaign, dateRange, sessionId }
}
