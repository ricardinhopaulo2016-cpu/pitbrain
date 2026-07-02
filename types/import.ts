export type ImportMode =
  | 'replace_current'
  | 'append_new_batch'
  | 'merge_deduplicate'

export const IMPORT_MODE_LABELS: Record<ImportMode, string> = {
  replace_current:    'Substituir análise atual',
  append_new_batch:   'Adicionar como novo lote',
  merge_deduplicate:  'Atualizar / deduplicar',
}

export const IMPORT_MODE_DESCRIPTIONS: Record<ImportMode, string> = {
  replace_current:   'Descarta os dados anteriores e usa apenas este arquivo.',
  append_new_batch:  'Salva como lote separado no histórico (não altera a análise ativa).',
  merge_deduplicate: 'Mescla com os dados existentes, removendo linhas duplicadas.',
}

export interface ImportSession {
  id:            string
  fileName:      string
  fileHash:      string
  sourceType:    string
  importedAt:    string
  rowCount:      number
  dateRange?:    { start: string; end: string }
  mode:          ImportMode
  hasStoredData: boolean
}
