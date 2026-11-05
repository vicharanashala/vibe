/**
 * Camera integrity checks run on a live MediaStream before proctoring starts.
 * Ported from the current frontend (utils/proctoring/detectVirtualCamera.ts +
 * proctoringGuard.ts) with the same rules, minus debug logging.
 *
 * These are deterrents, not proof: browsers expose only the device label and
 * track settings, so a renamed virtual camera can still pass.
 */

export interface VirtualCameraCheck {
  isVirtual: boolean;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
  matchedLabel?: string;
}

export interface StreamQualityCheck {
  isSuspicious: boolean;
  reason: string;
}

export type ProctoringViolation =
  | ({ type: 'VIRTUAL_CAMERA'; severity: 'HIGH' } & VirtualCameraCheck)
  | ({ type: 'CAMERA_QUALITY'; severity: 'MEDIUM' } & StreamQualityCheck);

/** Device-label fragments of common virtual/spoofing cameras. */
export const VIRTUAL_CAMERA_KEYWORDS = [
  'obs',
  'virtual',
  'snap',
  'manycam',
  'droidcam',
  'epoccam',
  'camlink',
  'vcam',
  'xsplit',
  'nvidia broadcast',
  'broadcast',
] as const;

export function isSuspiciousCameraLabel(label: string): boolean {
  const lower = label.toLowerCase();
  return VIRTUAL_CAMERA_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export function detectVirtualCamera(stream?: MediaStream | null): VirtualCameraCheck {
  try {
    const label = stream?.getVideoTracks?.()[0]?.label?.trim() ?? '';
    if (label && isSuspiciousCameraLabel(label)) {
      return {
        isVirtual: true,
        confidence: 'high',
        reason: `This looks like a virtual camera ("${label}"). Please use your device's real camera.`,
        matchedLabel: label,
      };
    }
    return { isVirtual: false, confidence: 'medium', reason: 'Active camera is valid' };
  } catch (error) {
    return { isVirtual: false, confidence: 'low', reason: (error as Error)?.message || 'Detection failed' };
  }
}

/** Spoofed streams often report resolutions/frame rates no webcam produces. */
export function inspectStreamQuality(stream?: MediaStream | null): StreamQualityCheck {
  const track = stream?.getVideoTracks?.()[0];
  if (!track) return { isSuspicious: false, reason: 'No active video track' };

  const { width = 0, height = 0, frameRate = 0 } = track.getSettings?.() ?? {};
  if (width > 3840 || height > 2160 || frameRate > 60) {
    return {
      isSuspicious: true,
      reason: `Unusual camera stream: ${width}×${height} at ${frameRate} fps.`,
    };
  }
  return { isSuspicious: false, reason: 'Stream looks normal' };
}

/** Runs every check; an empty array means the stream may be used. */
export function runMediaChecks(stream?: MediaStream | null): ProctoringViolation[] {
  const violations: ProctoringViolation[] = [];
  const virtual = detectVirtualCamera(stream);
  if (virtual.isVirtual) violations.push({ type: 'VIRTUAL_CAMERA', severity: 'HIGH', ...virtual });
  const quality = inspectStreamQuality(stream);
  if (quality.isSuspicious) violations.push({ type: 'CAMERA_QUALITY', severity: 'MEDIUM', ...quality });
  return violations;
}
