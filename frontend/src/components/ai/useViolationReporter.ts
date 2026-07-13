import { useCallback, useRef } from "react";
import { useReportAnomalyImage } from "@/hooks/hooks";
import { useCourseStore } from "@/store/course-store";
import { AnomalyType, type ViolationMetadata } from "@/types/reportanomaly.types";

/**
 * useViolationReporter
 * ---------------------
 * Thin adapter between a detector (e.g. LivenessDetector) and the existing
 * `POST /anomalies/record/image` endpoint via useReportAnomalyImage(), the
 * same mutation floating-video.tsx already uses for NO_FACE / MULTIPLE_FACES
 * / BLUR_DETECTION. Because `metadata` was added to NewAnomalyData in the
 * schema PR, no backend/hook changes are needed here - this only adds a
 * frame-capture + submit convenience wrapper for the two new violation
 * types.
 *
 * Cooldown/debounce logic intentionally lives in the calling detector (it
 * already has the relevant timing state); this hook's only job is
 * "capture a frame + send what I'm told to send".
 *
 * NOTE: the dataURL->File conversion below duplicates a small helper that
 * currently lives inline inside floating-video.tsx. Extracting a single
 * shared `frontend/src/utils/screenshot.ts` would be a good, separate,
 * small cleanup PR - not bundled here to keep this change focused.
 */

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

export function useViolationReporter(
  videoRef: React.RefObject<HTMLVideoElement | null>,
) {
  const reportImage = useReportAnomalyImage();
  const courseStore = useCourseStore();
  const inFlightRef = useRef(false);

  const reportViolation = useCallback(
    async (
      type: AnomalyType.LIVENESS | AnomalyType.LOOKING_AWAY,
      metadata: ViolationMetadata,
    ) => {
      // Simple re-entrancy guard - the detector already cools down per
      // violation type, this just prevents overlapping in-flight requests
      // if two different signals fire back-to-back.
      if (inFlightRef.current) return;

      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        console.log("Video not ready, skipping liveness violation report");
        return;
      }

      const { courseId, versionId, itemId } = courseStore.currentCourse ?? {};
      if (!courseId || !versionId || !itemId) {
        console.log("Missing course data, skipping liveness violation report");
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const snapshot = canvas.toDataURL("image/png");
      const imageFile = dataUrlToFile(snapshot, `${type.toLowerCase()}.png`);

      inFlightRef.current = true;
      try {
        await reportImage.mutateAsync({
          body: {
            type,
            courseId,
            versionId,
            itemId,
            metadata,
          },
          file: imageFile,
        });
      } catch (error) {
        console.log(`Error while reporting ${type} violation:`, error);
      } finally {
        inFlightRef.current = false;
      }
    },
    [videoRef, courseStore, reportImage],
  );

  return { reportViolation };
}

export default useViolationReporter;
