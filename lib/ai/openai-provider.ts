import OpenAI from 'openai'
import type { AIProvider } from './provider'
import type { SummaryMetrics } from '@/types/metrics'
import type { DiagnosisResponse } from '@/types/diagnosis'
import { buildDiagnosisPrompt } from '@/lib/prompts/diagnosis-prompt'
import { extractJSON } from './utils'

export class OpenAIProvider implements AIProvider {
  readonly providerName = 'openai'
  readonly modelName: string
  private client: OpenAI

  constructor() {
    this.modelName = process.env.OPENAI_MODEL ?? 'gpt-4o'
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }

  async analyzePerformance(metrics: SummaryMetrics): Promise<DiagnosisResponse> {
    const { system, user } = buildDiagnosisPrompt(metrics)

    const response = await this.client.chat.completions.create({
      model: this.modelName,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    })

    const content = response.choices[0].message.content
    if (!content) throw new Error('OpenAI returned empty content')
    return extractJSON(content)
  }
}
