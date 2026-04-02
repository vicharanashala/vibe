import { detectVirtualCamera, inspectCameraStreamQuality } from "./detectVirtualCamera";

/**
 * Central Proctoring Guard
 *
 * Runs all proctoring validations on the active media stream.
 *
 * Why:
 * - Avoid duplicating checks across multiple components
 * - Ensure consistent enforcement (entry, runtime, restart)
 * - Easily extend with new proctoring rules
 */
export async function runProctoringChecks(stream?: MediaStream) {
  const results: any[] = [];

  // ------------------------------------------------------------
  // 1. Virtual Camera Detection (label-based)
  // ------------------------------------------------------------
  const virtualCamCheck = await detectVirtualCamera(stream);

  if (virtualCamCheck.isVirtual) {
    results.push({
      type: "VIRTUAL_CAMERA",
      severity: "HIGH",
      ...virtualCamCheck,
    });
  }

  // ------------------------------------------------------------
  // 2. Camera Stream Quality Check (fps/resolution)
  // ------------------------------------------------------------
  const qualityCheck = inspectCameraStreamQuality(stream);

  if (qualityCheck.isSuspicious) {
    results.push({
      type: "CAMERA_QUALITY",
      severity: "MEDIUM",
      ...qualityCheck,
    });
  }

  return results;
}