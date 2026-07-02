import type {
  BudgetMode,
  StructureStatus,
  StructureType,
  ParsedCampaignName,
  ParsedAdSetName,
  ParsedAdName,
} from '@/types/campaign-structure'

// ── Helpers ──────────────────────────────────────────────────────────────────

function toUpper(s: string) { return s.toUpperCase() }
function hasPart(parts: string[], token: string) {
  return parts.some(p => p.toUpperCase() === token.toUpperCase())
}

function detectStatus(name: string): StructureStatus {
  const upper = toUpper(name)
  const parts = name.split(/[-_\s\/]/)
  if (hasPart(parts, 'ON') || upper.endsWith('-ON') || upper.endsWith('_ON'))   return 'on'
  if (hasPart(parts, 'OFF') || upper.endsWith('-OFF') || upper.endsWith('_OFF')) return 'off'
  return 'unknown'
}

function detectBudgetMode(name: string): BudgetMode {
  const upper = toUpper(name)
  if (/\bABO\b/.test(upper)) return 'ABO'
  if (/\bCBO\b/.test(upper)) return 'CBO'
  return 'unknown'
}

function detectStructureType(name: string): { type: StructureType; baseBudget?: number } {
  // TC50 → type=TC, baseBudget=50
  const tcMatch = name.match(/\bTC(\d+)\b/i)
  if (tcMatch) return { type: 'TC', baseBudget: parseInt(tcMatch[1]) }

  const upper = toUpper(name)
  if (/\bESCALA?\b/.test(upper) || /\bESC\b/.test(upper)) return { type: 'ESCALA' }
  if (/\bLAL\b/.test(upper) || /\bLOOKALIKE\b/.test(upper)) return { type: 'LAL' }
  if (/\bRET(ARGETING)?\b/.test(upper) || /\bRTG\b/.test(upper)) return { type: 'RETARGETING' }

  return { type: 'unknown' }
}

function detectRemessa(name: string): string | undefined {
  // R14 or R14-2
  const m = name.match(/\bR(\d+)(?:-\d+)?\b/i)
  if (m) return `R${m[1]}`
  return undefined
}

function detectDate(name: string): string | undefined {
  // 25/06 or 25-06
  const m = name.match(/\b(\d{1,2})[\/\-](\d{2})\b/)
  if (m) return `${m[1]}/${m[2]}`
  return undefined
}

function detectFunil(name: string): string | undefined {
  const upper = toUpper(name)
  if (/\bFNL\b/.test(upper) || /\bFUNDO\b/.test(upper) || /\bBOF\b/.test(upper)) return 'Fundo'
  if (/\bTOF?\b/.test(upper) || /\bTOP\b/.test(upper))  return 'Topo'
  if (/\bMOF?\b/.test(upper) || /\bMID\b/.test(upper))  return 'Meio'
  return undefined
}

function detectObjective(name: string): string | undefined {
  const upper = toUpper(name)
  if (/\bMAXVOL\b/.test(upper)) return 'Max Volume'
  if (/\bCONV(ERS)?\b/.test(upper)) return 'Conversão'
  if (/\bPURCH\b/.test(upper)) return 'Compras'
  if (/\bLEAD\b/.test(upper)) return 'Leads'
  return undefined
}

// ── Public parsers ────────────────────────────────────────────────────────────

export function parseCampaignName(name: string): ParsedCampaignName {
  const { type, baseBudget } = detectStructureType(name)
  return {
    structureType: type,
    budgetMode:    detectBudgetMode(name),
    status:        detectStatus(name),
    baseBudget,
    remessa:       detectRemessa(name),
    date:          detectDate(name),
    funil:         detectFunil(name),
    objective:     detectObjective(name),
  }
}

export function parseAdSetName(name: string): ParsedAdSetName {
  // CJ01, CJ02, ...
  const cjMatch = name.match(/\bCJ(\d+)\b/i)
  const cjNumber = cjMatch ? `CJ${cjMatch[1].padStart(2, '0')}` : undefined

  // Budget in name: R$50, R$300
  const budgetMatch = name.match(/R\$\s*(\d+(?:[,.]\d+)?)/i)
  let budget: number | undefined
  if (budgetMatch) {
    budget = parseFloat(budgetMatch[1].replace(',', '.'))
  } else {
    // Also try plain number after hyphen if there's a TC## reference
    const tcMatch = name.match(/TC(\d+)/i)
    if (tcMatch) budget = parseInt(tcMatch[1])
  }

  return {
    status:    detectStatus(name),
    cjNumber,
    budget,
  }
}

export function parseAdName(name: string): ParsedAdName {
  const parts = name.split(/[-_]/).map(p => p.trim()).filter(Boolean)

  // VR## → video variant
  const vrMatch = name.match(/\bVR(\d+)\b/i)
  const vr = vrMatch ? `VR${vrMatch[1]}` : undefined

  // Detect editor: often initials (2-4 UPPERCASE letters not matching known keywords)
  const KNOWN_KEYWORDS = new Set([
    'ON', 'OFF', 'ABO', 'CBO', 'TC', 'VR', 'FNL', 'TOF', 'MOF', 'BOF',
    'TOP', 'MID', 'BOT', 'CJ', 'LAL', 'ESC',
  ])
  const editorParts = parts.filter(p =>
    /^[A-Z]{2,5}$/i.test(p) &&
    !KNOWN_KEYWORDS.has(p.toUpperCase()) &&
    !/^\d+$/.test(p) &&
    parts.indexOf(p) > parts.length / 2  // editors usually appear after the content descriptors
  )
  const editor = editorParts.length > 0 ? editorParts[0] : undefined

  // Best-effort structural fields
  // The naming convention varies by client — we extract what we can
  const hook    = parts.length > 0 ? parts[0] : undefined
  const body    = parts.length > 1 ? parts[1] : undefined
  const copy    = parts.length > 2 ? parts[2] : undefined
  const funil   = detectFunil(name)
  const remessa = detectRemessa(name)

  return {
    status: detectStatus(name),
    hook,
    body,
    copy,
    editor,
    funil,
    remessa,
    vr,
  }
}

// ── Alert generators ──────────────────────────────────────────────────────────

export function generateAdAlerts(name: string): string[] {
  const alerts: string[] = []
  if (detectStatus(name) === 'unknown') alerts.push('Status não identificado no nome')
  // Detect names that are too short or too generic
  if (name.split(/[-_]/).length < 2) alerts.push('Nome muito curto — verificar nomenclatura')
  return alerts
}

export function generateAdSetAlerts(
  name: string,
  budget: number | undefined,
  baseBudget: number | undefined,
): string[] {
  const alerts: string[] = []
  if (detectStatus(name) === 'unknown') alerts.push('Status não identificado no nome')
  if (!name.match(/CJ\d+/i))           alerts.push('Número CJ não identificado')
  if (baseBudget && budget && budget > baseBudget * 2) {
    alerts.push(`Budget R$${budget} acima do base (R$${baseBudget}) — possível winner promovido`)
  }
  return alerts
}
