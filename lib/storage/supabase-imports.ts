import type { PitbrainImport, PitbrainImportPatch } from '@/types/pitbrain'

// Server-only mappers between the app's camelCase PitbrainImport shape
// and the pitbrain_imports table's snake_case columns.

export function rowToImport(row: Record<string, unknown>): PitbrainImport {
  return {
    id: row.id as string,
    name: row.name as string,
    originalFileName: (row.original_file_name as string) ?? '',
    source: 'utmify',
    sourceType: row.source_type as PitbrainImport['sourceType'],
    breakdownLevel: (row.breakdown_level as PitbrainImport['breakdownLevel']) ?? undefined,
    dimensionField: (row.dimension_field as string) ?? undefined,
    dimensionLabel: (row.dimension_label as string) ?? undefined,
    product: (row.product as string) ?? undefined,
    funnelGroup: (row.funnel_group as string) ?? undefined,
    tags: (row.tags as string[]) ?? undefined,
    periodLabel: (row.period_label as string) ?? undefined,
    dateRange: (row.date_range as PitbrainImport['dateRange']) ?? null,
    rows: (row.rows as unknown[]) ?? [],
    footerTotals: (row.footer_totals as unknown[]) ?? [],
    summary: (row.summary as PitbrainImport['summary']) ?? ({} as PitbrainImport['summary']),
    rowCount: (row.row_count as number) ?? 0,
    ignoredFooterRowsCount: (row.ignored_footer_rows_count as number) ?? 0,
    fileHash: (row.file_hash as string) ?? '',
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

export function importToRow(
  imp: PitbrainImport,
  ctx: { workspaceId: string; createdBy: string }
): Record<string, unknown> {
  return {
    id: imp.id,
    workspace_id: ctx.workspaceId,
    created_by: ctx.createdBy,
    name: imp.name,
    original_file_name: imp.originalFileName ?? null,
    source: imp.source ?? 'utmify',
    source_type: imp.sourceType,
    breakdown_level: imp.breakdownLevel ?? null,
    dimension_field: imp.dimensionField ?? null,
    dimension_label: imp.dimensionLabel ?? null,
    product: imp.product ?? null,
    funnel_group: imp.funnelGroup ?? null,
    tags: imp.tags ?? [],
    period_label: imp.periodLabel ?? null,
    date_range: imp.dateRange ?? null,
    rows: imp.rows ?? [],
    footer_totals: imp.footerTotals ?? [],
    summary: imp.summary ?? {},
    row_count: imp.rowCount ?? 0,
    ignored_footer_rows_count: imp.ignoredFooterRowsCount ?? 0,
    file_hash: imp.fileHash ?? null,
    created_at: imp.createdAt,
    updated_at: imp.updatedAt,
  }
}

export function patchToRow(patch: PitbrainImportPatch): Record<string, unknown> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) row.name = patch.name
  if (patch.product !== undefined) row.product = patch.product
  if (patch.funnelGroup !== undefined) row.funnel_group = patch.funnelGroup
  if (patch.tags !== undefined) row.tags = patch.tags
  if (patch.periodLabel !== undefined) row.period_label = patch.periodLabel
  return row
}
