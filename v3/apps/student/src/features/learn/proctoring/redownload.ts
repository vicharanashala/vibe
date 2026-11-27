import { useCallback, useState } from 'react';

import { resetFaceModels } from '../detectors/use-face-recognition';
import { faceCountAssets, faceRecognitionAssets, gestureAssets, voiceAssets, type ModelAsset, type ModelCheck } from './assets';
import { simdSupported } from './browser';
import { clearProctoringCache, loadAssets } from './model-loader';
import { describeLoadError, IDLE_READINESS, type Readiness } from './readiness';

export const REDOWNLOAD_CHECKS: ModelCheck[] = ['faceCount', 'faceRecognition', 'gesture', 'voice'];

function assetsFor(check: ModelCheck, simd: boolean): ModelAsset[] {
  switch (check) {
    case 'faceCount':
      return faceCountAssets();
    case 'faceRecognition':
      return faceRecognitionAssets();
    case 'gesture':
      return gestureAssets(simd);
    case 'voice':
      return voiceAssets(simd);
  }
}

/**
 * "Download models again" outside the setup checklist: deletes the saved
 * models and downloads every check's files fresh, with progress per check,
 * without reloading the page. Files only: the checks themselves start in a lesson.
 */
export function useModelRedownload() {
  const [progress, setProgress] = useState<Partial<Record<ModelCheck, Readiness>> | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async (): Promise<{ failed: number }> => {
    setRunning(true);
    await clearProctoringCache();
    resetFaceModels();
    const simd = simdSupported();
    const set = (check: ModelCheck, next: Partial<Readiness>) =>
      setProgress((all) => ({ ...all, [check]: { ...(all?.[check] ?? IDLE_READINESS), ...next } }));
    setProgress(Object.fromEntries(REDOWNLOAD_CHECKS.map((c) => [c, { ...IDLE_READINESS, state: 'checking' }])));
    const outcomes = await Promise.all(
      REDOWNLOAD_CHECKS.map(async (check) => {
        try {
          const { fromCache, saved } = await loadAssets(assetsFor(check, simd), ({ state, received, total }) =>
            set(check, { state: state === 'done' || state === 'cached' ? 'ready' : state, received, total }),
          );
          set(check, { state: 'ready', fromCache, saved });
          return true;
        } catch (error) {
          set(check, { state: 'failed', error: describeLoadError(error) });
          return false;
        }
      }),
    );
    setRunning(false);
    return { failed: outcomes.filter((ok) => !ok).length };
  }, []);

  return { progress, running, run };
}
