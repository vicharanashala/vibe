import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const diag = vi.hoisted(() => ({ results: [] as unknown[] }));
vi.mock('./diagnostics', async (orig) => ({
  ...(await orig<object>()),
  runDiagnostics: async function* () {
    for (const r of diag.results) yield r;
  },
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { DiagnosticsPanel } from './diagnostics-view';

const actions = () => ({ downloadAgain: vi.fn(), clearAppFiles: vi.fn(), reload: vi.fn() });

describe('DiagnosticsPanel', () => {
  it('shows each result with its fix, sums up the problems, and copies the report', async () => {
    diag.results = [
      { id: 'wasm', label: 'WebAssembly', status: 'pass', detail: 'Supported, with SIMD.' },
      { id: 'host-x', label: 'Model server: cdn.jsdelivr.net', status: 'fail', detail: 'Couldn’t be reached.', fix: 'Try another network.' },
      { id: 'storage', label: 'Storage space', status: 'warn', detail: 'About 10.0 MB free.', fix: 'Free up disk space.' },
    ];
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<DiagnosticsPanel actions={actions()} />);

    expect(await screen.findByText('Found 1 problem and 1 warning. Each one says how to fix it.')).toBeInTheDocument();
    const host = within(screen.getByRole('listitem', { name: 'Model server: cdn.jsdelivr.net' }));
    expect(host.getByLabelText('Problem')).toBeInTheDocument();
    expect(host.getByText('Try another network.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Copy report/ }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('[FAIL] Model server: cdn.jsdelivr.net: Couldn’t be reached.'));
    expect(toast.success).toHaveBeenCalled();
  });

  it('runs again on request, and offers the fixes', async () => {
    diag.results = [{ id: 'wasm', label: 'WebAssembly', status: 'pass', detail: 'Supported.' }];
    const fix = actions();
    render(<DiagnosticsPanel actions={fix} />);
    expect(await screen.findByText('No problems found.')).toBeInTheDocument();
    diag.results = [{ id: 'webgl', label: 'WebGL graphics', status: 'fail', detail: 'Not available.' }];
    await userEvent.click(screen.getByRole('button', { name: /Run again/ }));
    await waitFor(() => expect(screen.getByRole('listitem', { name: 'WebGL graphics' })).toBeInTheDocument());
    expect(screen.queryByRole('listitem', { name: 'WebAssembly' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Fixes/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Download models again/ }));
    expect(fix.downloadAgain).toHaveBeenCalled();
  });
});
