/**
 * Virtual Camera Detection
 *
 * Prevents usage of software-based cameras (OBS, Snap Camera, etc.)
 * which can be used to spoof proctoring systems.
 *
 * Strategy:
 * - Inspect active MediaStream track (not all devices)
 * - Match against known virtual camera patterns
 *
 * Limitations:
 * - Cannot detect all spoofed cameras (browser limitation)
 */

export type VirtualCameraCheckResult = {
  isVirtual: boolean;
  confidence: "low" | "medium" | "high";
  reason: string;
  matchedLabel?: string;
  matchedDeviceId?: string;
};

const SUSPICIOUS_KEYWORDS = [
  "obs",
  "virtual",
  "snap",
  "manycam",
  "droidcam",
  "epoccam",
  "camlink",
  "vcam",
  "xsplit",
  "nvidia broadcast",
  "broadcast",
];

function matchesSuspiciousLabel(label: string) {
  const lower = label.toLowerCase();
  return SUSPICIOUS_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export async function detectVirtualCamera(
  stream?: MediaStream
): Promise<VirtualCameraCheckResult> {
  try {
    const track = stream?.getVideoTracks?.()[0];
    const trackLabel = track?.label?.trim() || "";

    console.log("Active camera:", trackLabel);

    if (trackLabel && matchesSuspiciousLabel(trackLabel)) {
      return {
        isVirtual: true,
        confidence: "high",
        reason: `Suspicious active track label detected: "${trackLabel}"`,
        matchedLabel: trackLabel,
        matchedDeviceId: track?.getSettings?.().deviceId,
      };
    }

    return {
      isVirtual: false,
      confidence: "medium",
      reason: "Active camera is valid",
    };

  } catch (error: any) {
    return {
      isVirtual: false,
      confidence: "low",
      reason: error?.message || "Detection failed",
    };
  }
}

// ------------------------------------------------------------
// Camera Stream Quality Check
// ------------------------------------------------------------

/**
 * Performs sanity checks on active camera stream.
 *
 * Why:
 * Virtual cameras or spoofed streams often expose unusual
 * resolution or frame rate values.
 *
 * This helps detect suspicious configurations without relying
 * only on device labels.
 */
export function inspectCameraStreamQuality(stream?: MediaStream) {
  const track = stream?.getVideoTracks?.()[0];

  if (!track) {
    return {
      isSuspicious: false,
      reason: "No active video track",
    };
  }

  const settings = track.getSettings?.();

  const width = settings?.width ?? 0;
  const height = settings?.height ?? 0;
  const frameRate = settings?.frameRate ?? 0;

  console.log("[Camera Quality]", { width, height, frameRate });

  const suspicious =
    width > 3840 ||   
    height > 2160 ||
    frameRate > 60;   // unusually high fps

  if (suspicious) {
    return {
      isSuspicious: true,
      reason: `Suspicious stream: ${width}x${height} @ ${frameRate}fps`,
    };
  }

  return {
    isSuspicious: false,
    reason: "Stream looks normal",
  };
}