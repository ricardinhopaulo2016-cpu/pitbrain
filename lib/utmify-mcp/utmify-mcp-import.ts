'use client'

// Client-safe (no dependency on UtmifyMcpClient, which is server-only) — this is what turns a
// normalized UTMify MCP pull (lib/utmify-mcp/utmify-mcp-normalizers.ts) into a real, persisted
// PitbrainImport, using the exact same storage path CSV/XLSX uploads already use
// (lib/storage/pitbrain-storage.ts's saveImport/setActiveImportId — no new persistence code).

import { saveImport, setActiveImportId } from '@/lib/storage/pitbrain-storage'
import { pitbrainImportToLastImport } from '@/lib/storage/imports'
import { saveCurrentDataset } from '@/lib/calculators/local-metrics'
import type { PitbrainImport, PitbrainImportSummary, BreakdownLevel } from '@/types/pitbrain'
import type { UtmifyBreakdownRow, UtmifyDailyRow } from '@/types/utmify'
import type { UtmifyDashboardOption, UtmifyMcpLevel, UtmifyMcpPlatform, UtmifyPeriod } from './utmify-mcp-normalizers'
import { dimensionFieldForLevel } from './utmify-mcp-normalizers'

export interface CreatePitbrainImportFromUtmifyMcpOptions {
  dashboard: UtmifyDashboardOption
  period: UtmifyPeriod
  summary: PitbrainImportSummary
  /** Undefined for a summary-only pull (no breakdown requested). */
  rows?: UtmifyBreakdownRow[]
  summaryRow: UtmifyDailyRow
  platform?: UtmifyMcpPlatform
  level?: UtmifyMcpLevel
}

function breakdownLevelForImport(level: UtmifyMcpLevel | undefined): BreakdownLevel | undefined {
  return level === 'campaign' || level === 'adset' || level === 'ad' ? level : undefined
}

/** Builds and persists a PitbrainImport from a UTMify MCP pull, then makes it the active import —
 * mirrors exactly what hooks/useUpload.ts does after a CSV/XLSX parse (saveImport → setActiveImportId
 * → saveCurrentDataset), just with MCP-normalized data instead of parsed file rows. */
export async function createPitbrainImportFromUtmifyMcp(
  opts: CreatePitbrainImportFromUtmifyMcpOptions
): Promise<PitbrainImport> {
  const { dashboard, period, summary, rows, summaryRow, platform, level } = opts

  const hasBreakdown = !!rows && rows.length > 0
  const now = new Date().toISOString()
  const id = crypto.randomUUID()

  const imp: PitbrainImport = {
    id,
    name: `UTMify MCP — ${dashboard.name} — ${period.label}`,
    originalFileName: `utmify-mcp:${dashboard.id}`,
    source: 'utmify',
    sourceType: 'utmify_mcp',
    breakdownLevel: hasBreakdown ? breakdownLevelForImport(level) : undefined,
    dimensionField: hasBreakdown && level ? dimensionFieldForLevel(level) : 'dashboard_summary',
    dimensionLabel: hasBreakdown && platform ? `${platform} · ${level}` : undefined,
    periodLabel: period.label,
    dateRange: { start: period.start, end: period.end },
    rows: hasBreakdown ? rows! : [summaryRow],
    summary,
    rowCount: hasBreakdown ? rows!.length : 1,
    ignoredFooterRowsCount: 0,
    fileHash: `mcp:${dashboard.id}:${platform ?? 'summary'}:${level ?? 'none'}:${now}`,
    createdAt: now,
    updatedAt: now,
  }

  const { saved } = await saveImport(imp)
  await setActiveImportId(saved.id)
  saveCurrentDataset(pitbrainImportToLastImport(saved))

  return saved
}
