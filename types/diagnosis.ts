export type DiagnosisStatus = 'bom' | 'atencao' | 'critico'
export type ActionPriority  = 'alta' | 'media' | 'baixa'
export type RiskLevel       = 'baixo' | 'medio' | 'alto'

export interface FunnelDiagnosis {
  status:    DiagnosisStatus
  diagnosis: string
  evidence:  string[]
  actions:   string[]
}

export interface RecommendedAction {
  action:   string
  reason:   string
  priority: ActionPriority
  risk:     RiskLevel
}

export interface TestForTomorrow {
  test:          string
  hypothesis:    string
  successMetric: string
}

export interface DiagnosisResponse {
  executiveSummary:   string
  topFunnel:          FunnelDiagnosis
  middleFunnel:       FunnelDiagnosis
  bottomFunnel:       FunnelDiagnosis
  mainBottleneck:     string
  recommendedActions: RecommendedAction[]
  testsForTomorrow:   TestForTomorrow[]
  risks:              string[]
  nextDecision:       string
}
