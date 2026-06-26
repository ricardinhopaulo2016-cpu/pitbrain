export type FunnelScore = 'bom' | 'atenção' | 'crítico'

export interface FunnelDiagnosis {
  diagnosis: string
  score: FunnelScore
  keyMetrics: string[]
}

export interface DiagnosisResponse {
  executiveSummary: string
  topFunnel: FunnelDiagnosis
  midFunnel: FunnelDiagnosis
  bottomFunnel: FunnelDiagnosis
  mainBottleneck: string
  goodCampaigns: string[]
  badCampaigns: string[]
  recommendedActions: string[]
  testsForTomorrow: string[]
  risks: string[]
}
