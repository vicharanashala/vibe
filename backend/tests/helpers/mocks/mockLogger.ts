import { vi } from 'vitest';

export const loggerMock = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  log: vi.fn(),
  child: vi.fn(() => loggerMock),
};

export function mockWinston() {
  vi.mock('winston', () => ({
    default: {
      createLogger: vi.fn(() => loggerMock),
      format: { combine: vi.fn(), timestamp: vi.fn(), json: vi.fn(), simple: vi.fn(), printf: vi.fn(), colorize: vi.fn() },
      transports: { Console: vi.fn(), File: vi.fn() },
    },
    createLogger: vi.fn(() => loggerMock),
    format: { combine: vi.fn(), timestamp: vi.fn(), json: vi.fn(), simple: vi.fn(), printf: vi.fn(), colorize: vi.fn() },
    transports: { Console: vi.fn(), File: vi.fn() },
  }));
}

export function resetLoggerMocks() {
  Object.values(loggerMock).forEach(fn => 'mockReset' in fn && fn.mockReset());
}
