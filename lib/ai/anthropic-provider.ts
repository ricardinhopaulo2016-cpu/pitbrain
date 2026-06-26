import OpenAI from 'openai'
import type { AIProvider } from './provider'
import type { SummaryMetrics } from '@/types/metrics'
import type { DiagnosisResponse } from '@/types/diagnosis'
import { buildDiagnosisPrompt } from '@/lib/prompts/diagnosis-prompt'
import { MissingAPIKeyError } from './errors'
import { extractJSON } from './utils'

export class AnthropicProvider implements AIProvider {
  readonly providerName = 'anthropic'
  readonly modelName: string
  private client: OpenAI

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new MissingAPIKeyError('Chave da Anthropic não configurada.')

    this.modelName = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'
    // Use OpenAI SDK pointing at Anthropic's OpenAI-compatible endpoint
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.anthropic.com/v1/',
      defaultHeaders: {
        'anthropic-version': '2023-06-01',
      },
    })
  }

  async analyzePerformance(metrics: SummaryMetrics): Promise<DiagnosisResponse> {
    const { system, user } = buildDiagnosisPrompt(metrics)

    // Anthropic's compat layer doesn't guarantee response_format support;
    // JSON output is enforced via the system prompt instead.
    const response = await this.client.chat.completions.create({
      model: this.modelName,
      temperature: 0.3,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    })

    const content = response.choices[0].message.content
    if (!content) throw new Error('Anthropic returned empty content')
    return extractJSON(content)
  }
}
