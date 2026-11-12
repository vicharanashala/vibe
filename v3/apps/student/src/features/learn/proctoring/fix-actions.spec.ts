import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { fixActions } from './fix-actions';

const loader = vi.hoisted(() => ({ clearProctoringCache: vi.fn(async () => undefined), clearAppFiles: vi.fn(async () => undefined) }));
vi.mock('./model-loader', async (orig) => ({ ...(await orig<object>()), ...loader }));
const face = vi.hoisted(() => ({ resetFaceModels: vi.fn() }));
vi.mock('../detectors/use-face-recognition', () => face);

describe('fixActions', () => {
  it('“Download models again” clears the saved models, forgets loaded ones and restarts the checks', async () => {
    const restart = vi.fn();
    const reload = vi.fn();
    fixActions(restart, reload).downloadAgain();
    await waitFor(() => expect(restart).toHaveBeenCalled());
    expect(loader.clearProctoringCache).toHaveBeenCalled();
    expect(face.resetFaceModels).toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads instead when there are no checks to restart', async () => {
    const reload = vi.fn();
    fixActions(undefined, reload).downloadAgain();
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it('“Clear app files and reload” clears, then reloads', async () => {
    const reload = vi.fn();
    fixActions(vi.fn(), reload).clearAppFiles();
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(loader.clearAppFiles).toHaveBeenCalled();
  });
});
