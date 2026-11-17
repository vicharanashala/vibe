import {getContainer} from '#root/bootstrap/loadModules.js';
import {ANALYTICS_TYPES} from './types.js';

type Sink = (versionId: string, userId: string) => Promise<void>;
let override: Sink | null | undefined;

/** Test seam: route notifications to `sink` (null = drop them). */
export function setAnalyticsSinkForTests(sink: Sink | null | undefined) {
  override = sink;
}

function resolveSink(): Sink | null {
  if (override !== undefined) return override;
  try {
    const projector = getContainer().get<{
      learnerChanged: (v: string, u: string) => Promise<void>;
    }>(ANALYTICS_TYPES.AnalyticsProjector);
    return (v, u) => projector.learnerChanged(v, u);
  } catch {
    // No app container (unit tests) or analytics not loaded: nothing to update.
    return null;
  }
}

/**
 * Tells course analytics that one learner's records changed. Call it only
 * after the student's own write has committed. Fire-and-forget: it returns
 * immediately, never throws, and an analytics failure is only logged, so it
 * can never fail or delay the student's request.
 */
export function notifyLearnerChanged(versionId: unknown, userId: unknown) {
  if (!versionId || !userId) return;
  try {
    const sink = resolveSink();
    if (!sink) return;
    void sink(String(versionId), String(userId)).catch(err =>
      console.warn('[analytics] learner update failed:', err?.message ?? err),
    );
  } catch (err: any) {
    console.warn('[analytics] learner update failed:', err?.message ?? err);
  }
}
