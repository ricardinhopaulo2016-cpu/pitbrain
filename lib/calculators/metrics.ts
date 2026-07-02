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
  // Aggregate UTMify by campaign.
  // Rows may actually be UtmifyDailyRow (daily aggregate) even though typed as UtmifySession —
  // guard every field access to avoid TypeError on missing fields.
  const utmByCampaign = new Map<string, { revenue: number; purchases: number; pageViews: number; checkouts: number }>()

  for (const session of utmifyRows) {
    const r = session as unknown as Record<string, unknown>
    const key = (r.utmCampaign as string | null) || '__unknown__'
    const current = utmByCampaign.get(key) ?? { revenue: 0, purchases: 0, pageViews: 0, checkouts: 0 }
    const status = r.status as string | undefined
    if (status && isPaidOrder(status)) {
      current.revenue += Number(r.grossRevenue) || 0
      current.purchases += 1
    }
    // UtmifyDailyRow uses 'initiateCheckout' (singular); UtmifySession uses 'initiateCheckouts' (plural)
    current.pageViews += Number(r.pageViews) || 0
    current.checkouts += Number(r.initiateCheckouts ?? r.initiateCheckout) || 0
    utmByCampaign.set(key, current)
  }

  // Group Meta rows by campaign
  const metaByCampaign = new Map<string, MetaCampaign[]>()
  for (const row of metaRows) {
    const key = row.campaignName || 'Sem nome'
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

  // If no Meta data but UTMify exists, aggregate UTMify totals.
  // Handle both UtmifySession (orders) and UtmifyDailyRow (daily aggregate) safely.
  if (metaRows.length === 0) {
    for (const session of utmifyRows) {
      const r = session as unknown as Record<string, unknown>
      if (r.sourceType === 'utmify_daily_aggregate') {
        // Daily aggregate row: revenue, spend, etc. are top-level fields
        totalRevenue    += Number(r.revenue) || 0
        totalPurchases  += Number(r.purchases) || 0
        totalPageViews  += Number(r.pageViews) || 0
        totalCheckouts  += Number(r.initiateCheckout) || 0
        totalSpend      += Number(r.spend) || 0
        totalImpressions += Number(r.impressions) || 0
        totalClicks     += Number(r.clicks) || 0
      } else {
        // Orders row: derive revenue from paid orders
        const status = r.status as string | undefined
        if (status && isPaidOrder(status)) {
          totalRevenue   += Number(r.grossRevenue) || 0
          totalPurchases += 1
        }
        totalPageViews  += Number(r.pageViews) || 0
        totalCheckouts  += Number(r.initiateCheckouts) || 0
      }
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
