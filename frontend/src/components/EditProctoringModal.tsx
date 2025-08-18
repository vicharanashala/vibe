import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useEditProctoringSettings, useGetProcotoringSettings } from "@/hooks/hooks"
import { useEffect, useState } from "react"
import { Label } from "./ui/label"
import { Separator } from "./ui/separator"
import { Switch } from "./ui/switch"

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

const labelMap: Record<string, string> = {
  cameraMic: "Camera + Microphone",
  blurDetection: "Blur Detection",
  faceCountDetection: "Face Count Detection",
  handGestureDetection: "Hand Gesture Detection",
  voiceDetection: "Voice Detection",
  virtualBackgroundDetection: "Virtual Background Detection",
  rightClickDisabled: "Right Click Disabled",
  faceRecognition: "Face Recognition",
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
  isNew: boolean
}) {
  const { editSettings, loading, error } = useEditProctoringSettings()
  const { getSettings, settingLoading, settingError } = useGetProcotoringSettings();

  const allComponents = Object.values(ProctoringComponent)
  const [detectors, setDetectors] = useState(
    allComponents.map((name) => ({ name, enabled: false }))
  )
  const [linearProgressionEnabled, setLinearProgressionEnabled] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const result = await getSettings(courseId, courseVersionId);
        setDetectors(result?.settings.proctors.detectors?.map((d: any) => ({ name: d.detectorName, enabled: d.settings.enabled })))
        setLinearProgressionEnabled(result.settings.linearProgressionEnabled)
      } catch (err) {
        console.error("Failed to fetch proctoring settings:", err)
      }
    }

    if (open) {
      fetchSettings()
    }
  }, [open])

  const toggle = (name: string) => {
    setDetectors((prev) =>  
      prev.map((d) =>
        d.name === name ? { ...d, enabled: !d.enabled } : d
      )
    )
  }

  const handleSubmit = async () => {
    const result = await editSettings(courseId, courseVersionId, detectors, isNew, linearProgressionEnabled)
    console.log("Proctoring settings updated:", result)
    if(result != undefined) {
      onClose();
    }
  }

  if (settingLoading) {
    return <div>Loading...</div>
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-background text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-center">Proctoring Settings</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="space-y-6 pt-4"
        >
          <div className="space-y-6">

            {/* Proctoring Controls Section */}
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">Proctoring Controls</h3>
                <p className="text-xs text-muted-foreground">Configure monitoring and detection features</p>
              </div>

              <div className="space-y-3">
                {detectors.map((detector) => (
                  <div key={detector.name} className="flex items-center space-x-2">
                    <Checkbox
                      id={detector.name}
                      checked={detector.enabled}
                      onCheckedChange={() => toggle(detector.name)}
                    />
                    <label
                      htmlFor={detector.name}
                      className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {labelMap[detector.name] || detector.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="my-6" />

            {/* Additional Settings Section */}
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">Additional Settings</h3>
                <p className="text-xs text-muted-foreground">Configure course behavior and progression</p>
              </div>

              <div className="flex items-center justify-between space-x-3">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Linear Course Progression</Label>
                  <p className="text-xs text-muted-foreground">Students must follow lessons sequentially</p>
                </div>
                <Switch checked={linearProgressionEnabled} onCheckedChange={()=>setLinearProgressionEnabled(prev=>!prev)} />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
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
