import type { SummaryMetrics } from '@/types/metrics'
import type { DiagnosisResponse } from '@/types/diagnosis'

export interface AIProvider {
  readonly providerName: string
  readonly modelName: string
  analyzePerformance(metrics: SummaryMetrics): Promise<DiagnosisResponse>
}
