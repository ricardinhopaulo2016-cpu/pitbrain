import type { MetaCampaign } from '@/types/meta'
import type {
  StructureData,
  CampaignStructure,
  AdSetStructure,
  AdStructure,
  StructureStatus,
} from '@/types/campaign-structure'
import { STRUCTURE_TYPE_LABELS } from '@/types/campaign-structure'
import {
  parseCampaignName,
  parseAdSetName,
  parseAdName,
  generateAdAlerts,
  generateAdSetAlerts,
} from './nomenclature-parser'

// ── Structural reading builder ────────────────────────────────────────────────

function buildStructuralReading(
  name: string,
  format: string,
  numAdsets: number,
  numAdsPerAdset: number,
  budgetMode: string,
  baseBudget: number | undefined,
  adsets: AdSetStructure[],
): string {
  const typeInfo = format.endsWith('-1') && numAdsPerAdset === 1
    ? 'Estrutura 1 anúncio por conjunto permite leitura individual de performance de cada criativo.'
    : `Estrutura com média de ${numAdsPerAdset} anúncio(s) por conjunto.`

  const onAdsets  = adsets.filter(a => a.status === 'on').length
  const offAdsets = adsets.filter(a => a.status === 'off').length

  const budgetModeText = budgetMode === 'ABO'
    ? 'modo ABO — orçamento controlado individualmente por conjunto.'
    : budgetMode === 'CBO'
      ? 'modo CBO — orçamento controlado no nível da campanha.'
      : 'modo de budget não identificado no nome.'

  const baseText = baseBudget
    ? ` com orçamento base de R$${baseBudget}`
    : ''

  const winnerInsight = (() => {
    if (!baseBudget) return ''
    const elevated = adsets.filter(a => a.budget && a.budget > baseBudget * 1.5 && a.status === 'on')
    if (elevated.length > 0) {
      return ` ${elevated.length} conjunto(s) com budget acima do base detectados — possível promoção de winners internos.`
    }
    return ''
  })()

  return (
    `Campanha em formato ${format}${baseText}. ${typeInfo} ` +
    `Operando em ${budgetModeText} ` +
    `${onAdsets} conjunto(s) ativos, ${offAdsets} inativo(s).` +
    winnerInsight
  )
}

// ── Alert builder ─────────────────────────────────────────────────────────────

function buildCampaignAlerts(
  adsets: AdSetStructure[],
  baseBudget: number | undefined,
  format: string,
): string[] {
  const alerts: string[] = []

  // Format detection
  if (format.endsWith('-1')) alerts.push(`Formato ${format} detectado — teste de criativos isolados`)

  // Budget inequality
  const budgets = adsets.map(a => a.budget).filter((b): b is number => b !== undefined)
  if (budgets.length > 1) {
    const min = Math.min(...budgets)
    const max = Math.max(...budgets)
    if (max > min * 1.5) alerts.push('Budget desigual entre conjuntos detectado')
  }

  // Winners
  if (baseBudget) {
    const elevated = adsets.filter(a => a.budget && a.budget > baseBudget * 1.5 && a.status === 'on')
    if (elevated.length > 0) {
      alerts.push(`${elevated.length} conjunto(s) ON com budget acima do base — possível winner(s) promovido(s)`)
    }
  }

  // Both off
  const fullyOff = adsets.filter(a => a.status === 'off' && a.ads.every(ad => ad.status === 'off'))
  if (fullyOff.length > 0) {
    alerts.push(`${fullyOff.length} conjunto(s) OFF com todos os anúncios OFF`)
  }

  // Ad naming issues
  const adAlerts = adsets.flatMap(a => a.ads.flatMap(ad => ad.alerts))
  if (adAlerts.length > 0) {
    alerts.push(`${adAlerts.length} alerta(s) de nomenclatura nos anúncios`)
  }

  return alerts
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildCampaignStructure(rows: MetaCampaign[]): StructureData {
  if (rows.length === 0) {
    return { campaigns: [], totalCampaigns: 0, totalAdsets: 0, totalAds: 0 }
  }

  // Group: campaign → adset → ads
  type AdsetMap = Map<string, { name: string; ads: MetaCampaign[]; spend: number; dateStart: string; dateStop: string }>
  type CampaignMap = Map<string, { name: string; adsets: AdsetMap }>

  const campaignMap: CampaignMap = new Map()

  for (const row of rows) {
    const cid = row.campaignId || `__cid_${row.campaignName}`
    const aid = row.adsetId   || `__aid_${row.adsetName}`

    if (!campaignMap.has(cid)) {
      campaignMap.set(cid, { name: row.campaignName, adsets: new Map() })
    }
    const campaign = campaignMap.get(cid)!

    if (!campaign.adsets.has(aid)) {
      campaign.adsets.set(aid, {
        name:      row.adsetName,
        ads:       [],
        spend:     0,
        dateStart: row.dateStart,
        dateStop:  row.dateStop,
      })
    }
    const adset = campaign.adsets.get(aid)!
    adset.ads.push(row)
    adset.spend += row.spend

    // Keep earliest start / latest end
    if (row.dateStart && (!adset.dateStart || row.dateStart < adset.dateStart)) adset.dateStart = row.dateStart
    if (row.dateStop  && (!adset.dateStop  || row.dateStop  > adset.dateStop))  adset.dateStop  = row.dateStop
  }

  const campaigns: CampaignStructure[] = []

  for (const [campaignId, campaignData] of campaignMap) {
    const parsedCampaign = parseCampaignName(campaignData.name)

    // Build adsets
    const adsets: AdSetStructure[] = []
    for (const [adsetId, adsetData] of campaignData.adsets) {
      const parsedAdset = parseAdSetName(adsetData.name)

      // Use baseBudget if budget not found in name but there's TC## in campaign
      const effectiveBudget = parsedAdset.budget ?? (
        parsedCampaign.baseBudget && adsetData.spend > 0 ? undefined : undefined
      )

      const adsetAlerts = generateAdSetAlerts(
        adsetData.name,
        parsedAdset.budget,
        parsedCampaign.baseBudget,
      )

      // Build ads (deduplicate by adId)
      const seenAdIds = new Set<string>()
      const ads: AdStructure[] = []
      for (const row of adsetData.ads) {
        const adId = row.adId || `__adid_${row.adName}`
        if (seenAdIds.has(adId)) continue
        seenAdIds.add(adId)

        const parsedAd = parseAdName(row.adName)
        const adAlerts = generateAdAlerts(row.adName)

        ads.push({
          adId,
          adName:  row.adName,
          status:  parsedAd.status,
          hook:    parsedAd.hook,
          body:    parsedAd.body,
          copy:    parsedAd.copy,
          editor:  parsedAd.editor,
          funil:   parsedAd.funil,
          remessa: parsedAd.remessa,
          produto: parsedAd.produto,
          vr:      parsedAd.vr,
          alerts:  adAlerts,
        })
      }

      adsets.push({
        adsetId,
        adsetName:  adsetData.name,
        status:     parsedAdset.status,
        budget:     effectiveBudget,
        spend:      adsetData.spend,
        dateStart:  adsetData.dateStart,
        dateStop:   adsetData.dateStop,
        cjNumber:   parsedAdset.cjNumber,
        ads,
        alerts:     adsetAlerts,
      })
    }

    // Sort adsets by CJ number, then by name
    adsets.sort((a, b) => {
      const na = a.cjNumber ?? a.adsetName
      const nb = b.cjNumber ?? b.adsetName
      return na.localeCompare(nb)
    })

    // Calculate format
    const numAdsets      = adsets.length
    const totalAdsInCamp = adsets.reduce((s, a) => s + a.ads.length, 0)
    const avgAdsPerAdset = numAdsets > 0 ? Math.round(totalAdsInCamp / numAdsets) : 0
    const format         = `1-${numAdsets}-${avgAdsPerAdset}`

    // Campaign alerts
    const campaignAlerts = buildCampaignAlerts(adsets, parsedCampaign.baseBudget, format)

    // Structural reading
    const structuralReading = buildStructuralReading(
      campaignData.name,
      format,
      numAdsets,
      avgAdsPerAdset,
      parsedCampaign.budgetMode,
      parsedCampaign.baseBudget,
      adsets,
    )

    campaigns.push({
      campaignId,
      campaignName:       campaignData.name,
      adsets,
      format,
      structureType:      parsedCampaign.structureType,
      structureTypeLabel: STRUCTURE_TYPE_LABELS[parsedCampaign.structureType],
      budgetMode:         parsedCampaign.budgetMode,
      status:             parsedCampaign.status,
      baseBudget:         parsedCampaign.baseBudget,
      remessa:            parsedCampaign.remessa,
      date:               parsedCampaign.date,
      funil:              parsedCampaign.funil,
      objective:          parsedCampaign.objective,
      totalAdsets:        numAdsets,
      totalAds:           totalAdsInCamp,
      alerts:             campaignAlerts,
      structuralReading,
    })
  }

  return {
    campaigns,
    totalCampaigns: campaigns.length,
    totalAdsets:    campaigns.reduce((s, c) => s + c.totalAdsets, 0),
    totalAds:       campaigns.reduce((s, c) => s + c.totalAds, 0),
  }
}

// ── Status helpers ────────────────────────────────────────────────────────────

export function statusColor(status: StructureStatus): string {
  return status === 'on' ? 'text-pb-green' : status === 'off' ? 'text-pb-red' : 'text-pb-muted'
}

export function statusBadge(status: StructureStatus): string {
  return status === 'on'
    ? 'bg-pb-green/10 border border-pb-green/30 text-pb-green'
    : status === 'off'
      ? 'bg-pb-red/10 border border-pb-red/30 text-pb-red'
      : 'bg-pb-border/10 border border-pb-border/30 text-pb-muted'
}

export function statusLabel(status: StructureStatus): string {
  return status === 'on' ? 'ON' : status === 'off' ? 'OFF' : '?'
}
