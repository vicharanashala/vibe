import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { deviceEntries, modelEntry, ProctoringSetup, type FixActions } from './proctoring-setup';
import { IDLE_READINESS, type Readiness } from './readiness';

const MB = 1024 * 1024;
const r = (over: Partial<Readiness>): Readiness => ({ ...IDLE_READINESS, ...over });
const actions = (): FixActions => ({ downloadAgain: vi.fn(), clearAppFiles: vi.fn(), reload: vi.fn() });

function show(entries: ReturnType<typeof modelEntry>[], fix = actions(), onRunDiagnostics?: () => void) {
  render(<ProctoringSetup entries={entries} hint="This lesson is proctored." actions={fix} onRunDiagnostics={onRunDiagnostics} />);
  return fix;
}
const row = (name: string) => within(screen.getByRole('listitem', { name }));

describe('ProctoringSetup', () => {
  it('shows real download progress, in MB and percent', () => {
    show([modelEntry('voice', 'Voice detection', r({ state: 'downloading', received: 1 * MB, total: 4 * MB }), vi.fn())]);
    expect(screen.getByRole('heading', { name: 'Getting this lesson ready' })).toBeInTheDocument();
    expect(row('Voice detection').getByText('Downloading: 1.0 of 4.0 MB · 25%')).toBeInTheDocument();
    expect(row('Voice detection').getByRole('progressbar', { name: 'Voice detection download' })).toHaveAttribute('aria-valuenow', '25');
  });

  it('shows MB received without a percentage when the size is unknown', () => {
    show([modelEntry('voice', 'Voice detection', r({ state: 'downloading', received: 3 * MB, total: null }), vi.fn())]);
    expect(row('Voice detection').getByText('Downloading: 3.0 MB')).toBeInTheDocument();
    expect(row('Voice detection').getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
  });

  it('says when a model was loaded from the device', () => {
    show([modelEntry('faceCount', 'Face detection', r({ state: 'ready', fromCache: true }), vi.fn())]);
    expect(row('Face detection').getByText('Saved on this device')).toBeInTheDocument();
  });

  it('says when a model couldn’t be saved', () => {
    show([modelEntry('faceCount', 'Face detection', r({ state: 'ready', saved: false }), vi.fn())]);
    expect(row('Face detection').getByText(/Couldn’t be saved on this device/)).toBeInTheDocument();
  });

  it('shows a failure with its reason and a Try again for that entry only', async () => {
    const retryVoice = vi.fn();
    show([
      modelEntry('faceCount', 'Face detection', r({ state: 'ready' }), vi.fn()),
      modelEntry('voice', 'Voice detection', r({ state: 'failed', error: 'Couldn’t reach the model server.' }), retryVoice),
    ]);
    expect(screen.getByRole('heading', { name: 'Something needs your attention' })).toBeInTheDocument();
    expect(row('Voice detection').getByText('Failed: couldn’t reach the model server.')).toBeInTheDocument();
    expect(row('Face detection').queryByRole('button', { name: /Try again/ })).not.toBeInTheDocument();
    await userEvent.click(row('Voice detection').getByRole('button', { name: /Try again/ }));
    expect(retryVoice).toHaveBeenCalledTimes(1);
  });

  it('shows a stalled download with its progress and a Try again', () => {
    show([modelEntry('gesture', 'Hand gestures', r({ state: 'stalled', received: 2 * MB, total: 8 * MB }), vi.fn())]);
    expect(row('Hand gestures').getByText(/Stalled: nothing received for 20 seconds \(2\.0 of 8\.0 MB · 25%\)/)).toBeInTheDocument();
    expect(row('Hand gestures').getByRole('button', { name: /Try again/ })).toBeInTheDocument();
  });

  it('explains a busy camera on the camera line, and lets the microphone wait', () => {
    const entries = deviceEntries({ state: 'off', reason: { problem: 'busy', device: 'camera' }, retry: vi.fn() }, true);
    show(entries);
    expect(row('Camera').getByText(/Another app is using your camera\. Close other apps/)).toBeInTheDocument();
    expect(row('Microphone').getByText('Waiting for the other device')).toBeInTheDocument();
  });

  it('lists only the camera when the lesson doesn’t use the microphone', () => {
    show(deviceEntries({ state: 'starting', reason: null, retry: vi.fn() }, false));
    expect(screen.getByRole('listitem', { name: 'Camera' })).toBeInTheDocument();
    expect(screen.queryByRole('listitem', { name: 'Microphone' })).not.toBeInTheDocument();
  });

  it('offers diagnostics and the fixes, confirming before clearing app files', async () => {
    const diagnose = vi.fn();
    const fix = show([modelEntry('voice', 'Voice detection', r({ state: 'checking' }), vi.fn())], actions(), diagnose);
    await userEvent.click(screen.getByRole('button', { name: /Run diagnostics/ }));
    expect(diagnose).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /More fixes/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Download models again/ }));
    expect(fix.downloadAgain).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /More fixes/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Clear app files and reload/ }));
    expect(fix.clearAppFiles).not.toHaveBeenCalled();
    expect(await screen.findByText(/You stay signed in, your settings are kept/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear and reload' }));
    expect(fix.clearAppFiles).toHaveBeenCalled();
  });
});
