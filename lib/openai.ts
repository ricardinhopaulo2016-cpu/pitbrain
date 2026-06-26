// Thin adapter kept for backwards compatibility with existing callers.
// All logic lives in lib/ai/.
import { getAIProvider } from './ai'
import type { SummaryMetrics } from '@/types/metrics'
import type { DiagnosisResponse } from '@/types/diagnosis'

export async function callDiagnosis(metrics: SummaryMetrics): Promise<DiagnosisResponse> {
  const provider = getAIProvider()
  return provider.analyzePerformance(metrics)
}
