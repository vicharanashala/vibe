/*import { Dialog, DialogContent } from "@radix-ui/react-dialog"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Save,X } from "lucide-react"
import { useUpdateProctoringSettings } from "@/hooks/hooks"


enum ProctoringComponent {
  CAMERAMICRO = 'cameraMic',
  BLURDETECTION = 'blurDetection',
  FACECOUNTDETECTION = 'faceCountDetection',
  HANDGESTUREDETECTION = 'handGestureDetection',
  VOICEDETECTION = 'voiceDetection',
  VIRTUALBACKGROUNDDETECTION = 'virtualBackgroundDetection',
  RIGHTCLICKDISABLED = 'rightClickDisabled',
  FACERECOGNITION = 'faceRecognition',
}
export default function EditProctoringModal({
  open,
  setOpen,
  courseId,
  versionId,
  currentSettings,
  refetch
}: {
  open : boolean;
  setOpen: (open: boolean) => void;
  courseId: string;
  versionId: string;
  currentSettings: { detectors: { detectorName: string; settings: { enabled: boolean } }[] };
  refetch: () => void;
}) {
  const [selectedDetectors, setSelectedDetectors] = useState<string[]>(
    currentSettings?.detectors
    .filter(detector => detector.settings.enabled)
    .map(detector => detector.detectorName) || []
  );

  const updateMutation = useUpdateProctoringSettings();

  const toggleDetector = (detectorName: string) => {
    setSelectedDetectors( prev=> 
      prev.includes(detectorName) ? 
      prev.filter(name => name !== detectorName) : 
      [...prev, detectorName]
    );
  };

  const save = async() => {
    await updateMutation.mutateAsync({
      params: { path: { courseId, courseVersionId: versionId } },
      body: {
        detectors: Object.values(ProctoringComponent).map(detectorName => ({
          detectorName,
          settings: { enabled: selectedDetectors.includes(detectorName) }
        }))
      }
    });
    refetch();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="space-y-4 ">
        <h3 className="text-lg font-semibold text-foreground">Edit Proctoring Settings</h3>
        
        <div className="space-y-3">
          {Object.values(ProctoringComponent).map(detectorName => (
            <div key={detectorName} className="flex items-center space-x-2">
              <Checkbox
                checked={selectedDetectors.includes(detectorName)}
                onCheckedChange={() => toggleDetector(detectorName)}
              />
              <span className="text-sm">{detectorName}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-4">
          <Button onClick={save} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Save className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
*/
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useEditProctoringSettings } from "@/hooks/hooks"

import { useState } from "react"

enum ProctoringComponent {
  CAMERAMICRO = 'cameraMic',
  BLURDETECTION = 'blurDetection',
  FACECOUNTDETECTION = 'faceCountDetection',
  HANDGESTUREDETECTION = 'handGestureDetection',
  VOICEDETECTION = 'voiceDetection',
  VIRTUALBACKGROUNDDETECTION = 'virtualBackgroundDetection',
  RIGHTCLICKDISABLED = 'rightClickDisabled',
  FACERECOGNITION = 'faceRecognition',
}

export function ProctoringModal({
  open,
  onClose,
  courseId,
  courseVersionId,
  isNew,
}: {
  open: boolean
  onClose: () => void
  courseId: string
  courseVersionId: string
  isNew: boolean // true = POST, false = PUT
}) {
  const allComponents = Object.values(ProctoringComponent)
  const { editSettings, loading, error } = useEditProctoringSettings()
  const [detectors, setDetectors] = useState(
    allComponents.map((name) => ({
      name,
      enabled: false,
    }))
  )

  const toggle = (name: string) => {
    setDetectors((prev) =>
      prev.map((d) =>
        d.name === name ? { ...d, enabled: !d.enabled } : d
      )
    )
  }

  const handleSubmit = async () => {
    await editSettings(courseId, courseVersionId, detectors, isNew)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-background text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Edit Proctoring Settings</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-4 pt-2"
        >
          <div className="space-y-3">
            {detectors.map((d) => (
              <div key={d.name} className="flex items-center space-x-2">
                <Checkbox
                  id={d.name}
                  checked={d.enabled}
                  onCheckedChange={() => toggle(d.name)}
                />
                <label htmlFor={d.name} className="text-sm capitalize leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {d.name}
                </label>
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
