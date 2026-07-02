import type { MetaCampaign, MetaAdset, MetaAd, MetaDarkPostAsset } from './meta-types'

// Client-side only. The Meta access token never reaches this module — only
// structural/read-only sync results (campaigns, adsets, ads, dark posts) are stored.

const META_SYNCS_KEY = 'pitbrain:metaSyncs'
const META_DARK_POSTS_KEY = 'pitbrain:metaDarkPosts'
const META_CAMPAIGN_STRUCTURE_KEY = 'pitbrain:metaCampaignStructure'
const META_SELECTED_AD_ACCOUNT_KEY = 'pitbrain:metaSelectedAdAccountId'

export interface StoredMetaSync {
  adAccountId: string
  syncedAt: string
  counts: {
    campaigns: number
    adsets: number
    ads: number
    creatives: number
    darkPosts: number
  }
}

export interface StoredMetaCampaignStructure {
  adAccountId: string
  syncedAt: string
  campaigns: MetaCampaign[]
  adsets: MetaAdset[]
  ads: MetaAd[]
}

// ── Sync history ────────────────────────────────────────────────────────────────

export function loadMetaSyncs(): StoredMetaSync[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(META_SYNCS_KEY)
    return raw ? (JSON.parse(raw) as StoredMetaSync[]) : []
  } catch { return [] }
}

export function saveMetaSync(sync: StoredMetaSync): void {
  try {
    const list = [sync, ...loadMetaSyncs().filter(s => s.adAccountId !== sync.adAccountId)]
    localStorage.setItem(META_SYNCS_KEY, JSON.stringify(list))
  } catch {}
}

export function getLastMetaSync(adAccountId?: string): StoredMetaSync | null {
  const list = loadMetaSyncs()
  if (!list.length) return null
  return (adAccountId ? list.find(s => s.adAccountId === adAccountId) : list[0]) ?? null
}

// ── Dark posts ───────────────────────────────────────────────────────────────────

export function loadMetaDarkPosts(): MetaDarkPostAsset[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(META_DARK_POSTS_KEY)
    return raw ? (JSON.parse(raw) as MetaDarkPostAsset[]) : []
  } catch { return [] }
}

/** Merges the latest sync's dark posts into storage, replacing any prior entry for the same ad. */
export function saveMetaDarkPosts(adAccountId: string, posts: MetaDarkPostAsset[]): void {
  try {
    void adAccountId
    const updatedIds = new Set(posts.map(p => p.adId))
    const kept = loadMetaDarkPosts().filter(p => !updatedIds.has(p.adId))
    localStorage.setItem(META_DARK_POSTS_KEY, JSON.stringify([...posts, ...kept]))
  } catch {}
}

// ── Campaign structure (raw campaigns/adsets/ads snapshot) ───────────────────────

export function loadMetaCampaignStructure(): StoredMetaCampaignStructure | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(META_CAMPAIGN_STRUCTURE_KEY)
    return raw ? (JSON.parse(raw) as StoredMetaCampaignStructure) : null
  } catch { return null }
}

export function saveMetaCampaignStructure(structure: StoredMetaCampaignStructure): void {
  try {
    localStorage.setItem(META_CAMPAIGN_STRUCTURE_KEY, JSON.stringify(structure))
  } catch {}
}

// ── Selected ad account ─────────────────────────────────────────────────────────

export function getSelectedAdAccountId(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(META_SELECTED_AD_ACCOUNT_KEY) } catch { return null }
}

export function setSelectedAdAccountId(id: string | null): void {
  try {
    if (id) localStorage.setItem(META_SELECTED_AD_ACCOUNT_KEY, id)
    else localStorage.removeItem(META_SELECTED_AD_ACCOUNT_KEY)
  } catch {}
}

// ── Convenience: persist a full sync result at once ───────────────────────────────

export function persistMetaSyncResult(result: {
  adAccountId: string
  syncedAt: string
  campaigns: MetaCampaign[]
  adsets: MetaAdset[]
  ads: MetaAd[]
  darkPosts: MetaDarkPostAsset[]
  counts: StoredMetaSync['counts']
}): void {
  saveMetaSync({ adAccountId: result.adAccountId, syncedAt: result.syncedAt, counts: result.counts })
  saveMetaDarkPosts(result.adAccountId, result.darkPosts)
  saveMetaCampaignStructure({
    adAccountId: result.adAccountId,
    syncedAt: result.syncedAt,
    campaigns: result.campaigns,
    adsets: result.adsets,
    ads: result.ads,
  })
}
