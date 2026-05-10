import { vi } from 'vitest';

export const transporterMock = {
  sendMail: vi.fn(async () => ({ messageId: 'mock-message-id', accepted: ['to@test.local'] })),
  verify: vi.fn(async () => true),
  close: vi.fn(),
};

export function mockNodemailer() {
  vi.mock('nodemailer', () => ({
    default: { createTransport: vi.fn(() => transporterMock) },
    createTransport: vi.fn(() => transporterMock),
  }));
}

export function resetMailerMocks() {
  Object.values(transporterMock).forEach(fn => 'mockReset' in fn && fn.mockReset());
}
