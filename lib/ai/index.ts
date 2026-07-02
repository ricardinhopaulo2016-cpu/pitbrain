import type { AIProvider } from './provider'
import { OpenAIProvider } from './openai-provider'
import { AnthropicProvider } from './anthropic-provider'
import { MockProvider } from './mock-provider'

export { MissingAPIKeyError } from './errors'
export type { AIProvider }

export function getAIProvider(): AIProvider {
  const name = (process.env.AI_PROVIDER ?? 'openai').toLowerCase().trim()

  if (name === 'anthropic') return new AnthropicProvider()
  if (name === 'mock')      return new MockProvider()

  // 'openai' or any unrecognized value → OpenAI (fallback)
  return new OpenAIProvider()
}
