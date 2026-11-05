import { useEffect, useRef, type RefObject } from 'react';

import { api } from '@/lib/api';

/** Backend AnomalyType values (anomalies/classes/transformers/Anomaly.ts). */
export type ReportedIncident =
  | 'NO_FACE'
  | 'MULTIPLE_FACES'
  | 'BLUR_DETECTION'
  | 'VOICE_DETECTION'
  | 'FACE_RECOGNITION';

/** At most one report of each type per this long, however long the problem lasts. */
export const REPORT_COOLDOWN_MS = 30_000;

export interface IncidentReportTarget {
  courseId: string;
  versionId: string;
  itemId: string;
}

/** A JPEG still from the camera feed, or null if the video has no frame yet. */
async function snapshot(video: HTMLVideoElement | null): Promise<Blob | null> {
  if (!video || !video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement('canvas');
  // Scaled down: evidence only needs to show who was in view.
  const scale = Math.min(1, 640 / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.75),
  );
}

/**
 * POST /anomalies/record/image (multipart: type, courseId, versionId, itemId,
 * optional `image`). If saving the photo fails (e.g. storage isn't
 * configured), the incident is still recorded without it.
 */
export async function reportIncident(
  target: IncidentReportTarget,
  type: ReportedIncident,
  photo: Blob | null,
) {
  const form = (withPhoto: boolean) => {
    const f = new FormData();
    f.append('type', type);
    f.append('courseId', target.courseId);
    f.append('versionId', target.versionId);
    f.append('itemId', target.itemId);
    if (withPhoto && photo)
      f.append('image', photo, `${type.toLowerCase()}.jpg`);
    return f;
  };
  const send = (withPhoto: boolean) =>
    api.POST('/api/anomalies/record/image', {
      body: {} as never,
      bodySerializer: () => form(withPhoto),
    });
  const first = await send(true);
  if (first.error && photo) await send(false);
}

/**
 * Records proctoring incidents as they start. `active` maps each incident type
 * to whether it's happening now; a report goes out when one switches on, and
 * again only after REPORT_COOLDOWN_MS if it's still (or again) happening.
 * Voice has no photo.
 */
export function useIncidentReporter(
  target: IncidentReportTarget,
  videoRef: RefObject<HTMLVideoElement | null>,
  active: Partial<Record<ReportedIncident, boolean>>,
  enabled: boolean,
) {
  const lastSent = useRef<Partial<Record<ReportedIncident, number>>>({});
  const wasActive = useRef<Partial<Record<ReportedIncident, boolean>>>({});
  const key = JSON.stringify(active);

  useEffect(() => {
    if (!enabled) {
      wasActive.current = {};
      return;
    }
    for (const type of Object.keys(active) as ReportedIncident[]) {
      const on = !!active[type];
      const started = on && !wasActive.current[type];
      wasActive.current[type] = on;
      if (!started) continue;
      const now = Date.now();
      if (now - (lastSent.current[type] ?? 0) < REPORT_COOLDOWN_MS) continue;
      lastSent.current[type] = now;
      void (
        type === 'VOICE_DETECTION'
          ? Promise.resolve(null)
          : snapshot(videoRef.current)
      )
        .then((photo) => reportIncident(target, type, photo))
        // Reporting must never interrupt the lesson.
        .catch(() => undefined);
    }
    // `key` stands in for `active`, which is a new object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, target.courseId, target.versionId, target.itemId]);
}
