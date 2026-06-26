import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function safeDiv(numerator: number, denominator: number): number {
  if (!denominator || denominator === 0) return 0
  return numerator / denominator
}

export function formatCurrency(value: number, locale = 'pt-BR', currency = 'BRL'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
}

export function formatPercent(value: number, decimals = 2): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: decimals }).format(value)
}

export function parseMonetaryValue(raw: string | undefined): number {
  if (!raw) return 0
  let cleaned = raw.replace(/[R$\s%]/g, '').trim()
  if (!cleaned) return 0

  const lastDot = cleaned.lastIndexOf('.')
  const lastComma = cleaned.lastIndexOf(',')

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      // Brazilian: 1.397,00 — dot=thousands, comma=decimal
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      // International: 1,397.00 — comma=thousands, dot=decimal
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (lastComma !== -1) {
    cleaned = cleaned.replace(',', '.')
  } else if (lastDot !== -1) {
    const afterDot = cleaned.substring(lastDot + 1)
    if (afterDot.length === 3) {
      // e.g. "1.000" — dot is a thousands separator, not decimal
      cleaned = cleaned.replace(/\./g, '')
    }
  }

  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Parse integer count fields (impressions, clicks, page views, IC, purchases).
 * ALL dots and commas are treated as thousands separators — these fields are always integers.
 * "2.264.000" → 2264000  |  "5.420" → 5420  |  "5,420" → 5420
 */
export function parseCountValue(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0
  if (typeof raw === 'number') return isNaN(raw) ? 0 : Math.round(raw)
  const str = String(raw).replace(/[%\s]/g, '').trim()
  if (!str) return 0
  const digits = str.replace(/[^0-9]/g, '')
  if (!digits) return 0
  const parsed = parseInt(digits, 10)
  return isNaN(parsed) ? 0 : parsed
}

export function parseNumericValue(raw: string | undefined): number {
  if (!raw) return 0
  let cleaned = raw.replace(/[%\s]/g, '').trim()
  if (!cleaned) return 0

  const lastDot = cleaned.lastIndexOf('.')
  const lastComma = cleaned.lastIndexOf(',')

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (lastComma !== -1) {
    cleaned = cleaned.replace(',', '.')
  }

  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}
