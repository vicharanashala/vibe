import { Checkbox } from "@/components/ui/checkbox";

// Mirrors backend/src/shared/database/interfaces/ISettingRepository.ts's
// ProctoringComponent enum values exactly.
export enum ProctoringComponent {
  CAMERAMICRO = "cameraMic",
  BLURDETECTION = "blurDetection",
  FACECOUNTDETECTION = "faceCountDetection",
  HANDGESTUREDETECTION = "handGestureDetection",
  VOICEDETECTION = "voiceDetection",
  VIRTUALBACKGROUNDDETECTION = "virtualBackgroundDetection",
  RIGHTCLICKDISABLED = "rightClickDisabled",
  FACERECOGNITION = "faceRecognition",
}

export const proctoringLabelMap: Record<string, string> = {
  cameraMic: "Camera + Microphone",
  blurDetection: "Blur Detection",
  faceCountDetection: "Face Count Detection",
  handGestureDetection: "Hand Gesture Detection",
  voiceDetection: "Voice Detection",
  virtualBackgroundDetection: "Virtual Background Detection",
  rightClickDisabled: "Right Click Disabled",
  faceRecognition: "Face Recognition",
};

// Mirrors backend's IDetectorSettings shape (shared/interfaces/models.ts) --
// the same shape items/modules/courses all validate and store.
export interface DetectorSetting {
  detectorName: ProctoringComponent;
  settings: { enabled: boolean };
}

export function allDetectorsOff(): DetectorSetting[] {
  return Object.values(ProctoringComponent).map(name => ({
    detectorName: name,
    settings: { enabled: false },
  }));
}

/**
 * Renders the 8 detector checkboxes for a given resolved detector list.
 * `value` is expected to contain every ProctoringComponent (same
 * @containsAllDetectors contract the backend enforces); a missing entry
 * simply renders unchecked.
 */
export function DetectorChecklist({
  value,
  onChange,
  disabled,
}: {
  value: DetectorSetting[];
  onChange: (next: DetectorSetting[]) => void;
  disabled?: boolean;
}) {
  const toggle = (name: ProctoringComponent) => {
    const exists = value.some(d => d.detectorName === name);
    const next = exists
      ? value.map(d =>
          d.detectorName === name
            ? { ...d, settings: { enabled: !d.settings.enabled } }
            : d,
        )
      : [...value, { detectorName: name, settings: { enabled: true } }];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {Object.values(ProctoringComponent).map(name => {
        const enabled =
          value.find(d => d.detectorName === name)?.settings.enabled ?? false;
        return (
          <div key={name} className="flex items-center space-x-2">
            <Checkbox
              id={name}
              checked={enabled}
              disabled={disabled}
              onCheckedChange={() => toggle(name)}
            />
            <label
              htmlFor={name}
              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {proctoringLabelMap[name] || name}
            </label>
          </div>
        );
      })}
    </div>
  );
}
