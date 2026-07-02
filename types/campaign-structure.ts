export type BudgetMode      = 'ABO' | 'CBO' | 'unknown'
export type StructureStatus = 'on' | 'off' | 'unknown'
export type StructureType   = 'TC' | 'ESCALA' | 'LAL' | 'RETARGETING' | 'unknown'

export const STRUCTURE_TYPE_LABELS: Record<StructureType, string> = {
  TC:          'TC — Teste de Criativos',
  ESCALA:      'Escala — Campanha de Escala',
  LAL:         'LAL — Lookalike',
  RETARGETING: 'Retargeting — Público Quente',
  unknown:     'Estrutura Não Identificada',
}

export interface ParsedCampaignName {
  structureType: StructureType
  budgetMode:    BudgetMode
  status:        StructureStatus
  baseBudget?:   number
  remessa?:      string
  date?:         string
  funil?:        string
  objective?:    string
}

export interface ParsedAdSetName {
  status:    StructureStatus
  cjNumber?: string
  budget?:   number
}

export interface ParsedAdName {
  status:   StructureStatus
  hook?:    string
  body?:    string
  copy?:    string
  editor?:  string
  funil?:   string
  remessa?: string
  produto?: string
  vr?:      string
}

export interface AdStructure {
  adId:     string
  adName:   string
  status:   StructureStatus
  hook?:    string
  body?:    string
  copy?:    string
  editor?:  string
  funil?:   string
  remessa?: string
  produto?: string
  vr?:      string
  alerts:   string[]
}

export interface AdSetStructure {
  adsetId:   string
  adsetName: string
  status:    StructureStatus
  budget?:   number
  spend:     number
  dateStart: string
  dateStop:  string
  cjNumber?: string
  ads:       AdStructure[]
  alerts:    string[]
}

export interface CampaignStructure {
  campaignId:        string
  campaignName:      string
  adsets:            AdSetStructure[]
  format:            string
  structureType:     StructureType
  structureTypeLabel: string
  budgetMode:        BudgetMode
  status:            StructureStatus
  baseBudget?:       number
  remessa?:          string
  date?:             string
  funil?:            string
  objective?:        string
  totalAdsets:       number
  totalAds:          number
  alerts:            string[]
  structuralReading: string
}

export interface StructureData {
  campaigns:       CampaignStructure[]
  totalCampaigns:  number
  totalAdsets:     number
  totalAds:        number
}
