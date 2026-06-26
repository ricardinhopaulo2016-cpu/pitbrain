import type { DiagnosisResponse } from '@/types/diagnosis'

// Strips markdown code fences if the model wraps JSON in ```json ... ```
export function extractJSON(raw: string): DiagnosisResponse {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
  return JSON.parse(stripped) as DiagnosisResponse
}
