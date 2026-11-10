import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DiagnosticsPanel } from './diagnostics-view';
import { clearProctoringCache, loadAssets } from './model-loader';

const diag = vi.hoisted(() => ({ results: [] as unknown[] }));
vi.mock('./diagnostics', async (orig) => ({
  ...(await orig<object>()),
  runDiagnostics: async function* () {
    for (const r of diag.results) yield r;
  },
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
vi.mock('./model-loader', async (orig) => ({ ...(await orig<object>()), clearProctoringCache: vi.fn(async () => undefined), loadAssets: vi.fn() }));
vi.mock('../detectors/use-face-recognition', () => ({ resetFaceModels: vi.fn() }));


describe('DiagnosticsPanel', () => {
  it('shows each result with its fix, sums up the problems, and copies the report', async () => {
    diag.results = [
      { id: 'wasm', label: 'WebAssembly', status: 'pass', detail: 'Supported, with SIMD.' },
      { id: 'host-x', label: 'Model server: cdn.jsdelivr.net', status: 'fail', detail: 'Couldn’t be reached.', fix: 'Try another network.' },
      { id: 'storage', label: 'Storage space', status: 'warn', detail: 'About 10.0 MB free.', fix: 'Free up disk space.' },
    ];
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<DiagnosticsPanel />);

    expect(await screen.findByText('Found 1 problem and 1 warning. Each one says how to fix it.')).toBeInTheDocument();
    const host = within(screen.getByRole('listitem', { name: 'Model server: cdn.jsdelivr.net' }));
    expect(host.getByLabelText('Problem')).toBeInTheDocument();
    expect(host.getByText('Try another network.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Copy report/ }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('[FAIL] Model server: cdn.jsdelivr.net: Couldn’t be reached.'));
    expect(toast.success).toHaveBeenCalled();
  });

  it('runs again on request', async () => {
    diag.results = [{ id: 'wasm', label: 'WebAssembly', status: 'pass', detail: 'Supported.' }];
    render(<DiagnosticsPanel />);
    expect(await screen.findByText('No problems found.')).toBeInTheDocument();
    diag.results = [{ id: 'webgl', label: 'WebGL graphics', status: 'fail', detail: 'Not available.' }];
    await userEvent.click(screen.getByRole('button', { name: /Run again/ }));
    await waitFor(() => expect(screen.getByRole('listitem', { name: 'WebGL graphics' })).toBeInTheDocument());
    expect(screen.queryByRole('listitem', { name: 'WebAssembly' })).not.toBeInTheDocument();
  });

  it('“Download models again” downloads every model here with progress, without a reload, then checks again', async () => {
    diag.results = [{ id: 'saved-models', label: 'Saved models', status: 'info', detail: 'None saved yet.' }];
    const finishers: (() => void)[] = [];
    vi.mocked(loadAssets).mockImplementation((_assets, onProgress) => {
      onProgress?.({ state: 'downloading', received: 1024 * 1024, total: 4 * 1024 * 1024 });
      return new Promise((resolve) => finishers.push(() => resolve({ files: {}, fromCache: false, saved: true })));
    });
    const restartChecks = vi.fn();
    render(<DiagnosticsPanel restartChecks={restartChecks} />);
    await screen.findByText('No problems found.');

    diag.results = [{ id: 'saved-models', label: 'Saved models', status: 'info', detail: 'Saved on this device: Face detection, Face recognition, Hand gestures, Voice detection.' }];
    await userEvent.click(screen.getByRole('button', { name: /Fixes/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Download models again/ }));

    const downloads = within(await screen.findByRole('list', { name: 'Model downloads' }));
    await waitFor(() => expect(downloads.getAllByText('Downloading: 1.0 of 4.0 MB · 25%')).toHaveLength(4));
    expect(clearProctoringCache).toHaveBeenCalled();
    expect(restartChecks).not.toHaveBeenCalled();

    act(() => finishers.forEach((f) => f()));
    await waitFor(() => expect(downloads.getAllByText('Ready. Saved on this device for next time')).toHaveLength(4));
    expect(toast.success).toHaveBeenCalledWith('Models downloaded and saved on this device.');
    expect(restartChecks).toHaveBeenCalled();
    expect(await screen.findByText(/Saved on this device: Face detection, Face recognition/)).toBeInTheDocument();
  });

  it('shows which model couldn’t be downloaded', async () => {
    diag.results = [];
    vi.mocked(loadAssets).mockImplementation(async (assets) => {
      if (assets.some((a) => a.url.includes('jsdelivr'))) throw new Error('Couldn’t reach the model server.');
      return { files: {}, fromCache: false, saved: true };
    });
    render(<DiagnosticsPanel />);
    await userEvent.click(screen.getByRole('button', { name: /Fixes/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Download models again/ }));
    const face = within(await screen.findByRole('listitem', { name: 'Face recognition' }));
    expect(await face.findByText(/^Failed:/)).toBeInTheDocument();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });
});
