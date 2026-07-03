// Do NOT reimplement BR number parsing or the Page Views/IC alias rules here — they're shared,
// load-bearing logic that other parts of the app depend on staying in sync. This file only
// re-exports the existing implementations so MCP-sourced data goes through the exact same rules
// as CSV/XLSX-sourced data.
//
// - BR money/percentage parsing: lib/utils.ts (parseMonetaryValue, parseNumericValue)
// - BR integer/count parsing: lib/utils.ts (parseCountValue)
// - "Page Views" ↔ "VIS. DE PÁG." aliasing, "IC"/"Add To Cart" fallback pairing:
//   lib/parsers/normalizer.ts (PAGE_VIEWS_ALIASES and the ic/add_to_cart alias tables) — those
//   aliases operate on column *headers*, not values, so there's nothing to re-export here beyond
//   the value parsers; an MCP result mapper should resolve its own field names to canonical ones
//   the same way lib/parsers/normalizer.ts does before calling these.

export { parseMonetaryValue, parseNumericValue, parseCountValue } from '@/lib/utils'
