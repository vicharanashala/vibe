import { toast } from 'sonner';

import { resetFaceModels } from '../detectors/use-face-recognition';
import { clearAppFiles, clearProctoringCache } from './model-loader';
import type { FixActions } from './proctoring-setup';

/**
 * The self-service fixes. `restartChecks` re-runs every model load (the
 * checks' retry functions); without one, "Download models again" reloads.
 */
export function fixActions(restartChecks?: () => void, reload: () => void = () => window.location.reload()): FixActions {
  return {
    downloadAgain: () => {
      void clearProctoringCache().then(() => {
        resetFaceModels();
        toast.success('Saved models deleted. Downloading them again…');
        if (restartChecks) restartChecks();
        else reload();
      });
    },
    clearAppFiles: () => {
      void clearAppFiles().then(reload);
    },
    reload,
  };
}
