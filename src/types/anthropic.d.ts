/**
 * Type declarations for @anthropic-ai/sdk
 * This is a minimal declaration to satisfy TypeScript until the package is installed.
 */

declare module '@anthropic-ai/sdk' {
  interface MessageCreateParams {
    model: string
    max_tokens: number
    temperature?: number
    system?: string
    messages: Array<{
      role: 'user' | 'assistant'
      content: string
    }>
  }

  interface ContentBlock {
    type: 'text'
    text: string
  }

  interface Usage {
    input_tokens: number
    output_tokens: number
  }

  interface Message {
    content: ContentBlock[]
    usage?: Usage
  }

  interface Messages {
    create(params: MessageCreateParams): Promise<Message>
  }

  interface AnthropicConfig {
    apiKey?: string
  }

  class Anthropic {
    constructor(config?: AnthropicConfig)
    messages: Messages
  }

  export default Anthropic
}
