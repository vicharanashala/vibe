import { vi } from 'vitest';

export const anthropicMessagesMock = {
  create: vi.fn(async () => ({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'mocked response' }],
    model: 'claude-test',
    stop_reason: 'end_turn',
    usage: { input_tokens: 1, output_tokens: 1 },
  })),
};

export const anthropicClientMock = {
  messages: anthropicMessagesMock,
  beta: { messages: anthropicMessagesMock },
};

export function mockAnthropic() {
  vi.mock('@anthropic-ai/sdk', () => ({
    default: vi.fn(() => anthropicClientMock),
    Anthropic: vi.fn(() => anthropicClientMock),
  }));
}

export function resetAnthropicMocks() {
  anthropicMessagesMock.create.mockReset();
}
