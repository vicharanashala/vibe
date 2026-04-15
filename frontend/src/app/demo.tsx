import { useEffect, useMemo, useState } from "react";
import { GraduationCap, BookOpen, BarChart3, Bell, Users, ArrowLeft, Camera, Eye, MoonStar, ScanFace, BadgeAlert } from "lucide-react";

import { AnimatedGridPattern } from "@/components/magicui/animated-grid-pattern";
import BlurDetection from "@/components/ai/BlurDetector";
import FaceDetectors from "@/components/ai/FaceDetectors";
import FaceRecognitionOverlay from "@/components/ai/FaceRecognitionOverlay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import useCameraProcessor from "@/components/ai/useCameraProcessor";
import type { FaceBehaviorStatus, FaceRecognition } from "@/types/ai.types";
import { cn } from "@/utils/utils";
import { missingFirebaseEnv } from "@/lib/firebase";

type DemoView = "role" | "student" | "teacher";

const studentCourses = [
  { title: "Physics Foundations", progress: 72, status: "In Progress" },
  { title: "Discrete Mathematics", progress: 48, status: "Keep Going" },
  { title: "Communication Skills", progress: 100, status: "Completed" },
];

const teacherCourses = [
  { title: "AI for Education", learners: 124, health: "Strong" },
  { title: "Applied Calculus", learners: 89, health: "Needs Review" },
  { title: "Research Writing", learners: 56, health: "Strong" },
];

const defaultBehavior: FaceBehaviorStatus = {
  isSlouching: false,
  isLookingDown: false,
  isSleepy: false,
  isYawning: false,
  isFatigued: false,
  fatigueScore: 0,
  eyeAspectRatio: 0,
  mouthAspectRatio: 0,
  headDownScore: 0,
};

function DemoBanner() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/95 p-4 text-sm text-amber-950 shadow-sm">
      <p className="font-semibold">Demo mode is on</p>
      <p className="mt-1 text-amber-900/90">
        Firebase and backend are not configured yet, so this is a frontend-only preview.
      </p>
      <p className="mt-3 font-medium">Missing env:</p>
      <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
{missingFirebaseEnv.join("\n")}
      </pre>
    </div>
  );
}

function RolePicker({ onPick }: { onPick: (view: DemoView) => void }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <AnimatedGridPattern
        numSquares={30}
        maxOpacity={0.1}
        duration={3}
        repeatDelay={1}
        className={cn(
          "[mask-image:radial-gradient(500px_circle_at_center,white,transparent)]",
          "absolute inset-0 h-full w-full",
        )}
      />

      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row">
        <div className="flex min-h-[40vh] flex-col justify-center bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6 lg:min-h-screen lg:flex-1 lg:p-12">
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center justify-center space-y-8 py-12 text-center">
            <Badge variant="secondary" className="px-4 py-1 text-sm">ViBe</Badge>
            <div className="space-y-4">
              <h2 className="text-5xl font-bold tracking-tight">
                Welcome to the future of learning
              </h2>
              <p className="mx-auto max-w-xl text-lg text-muted-foreground">
                Explore the interface first, then wire up Firebase and the backend when you are ready.
              </p>
            </div>
            <div className="grid w-full max-w-lg grid-cols-2 gap-4">
              <Card className="p-4 text-left">
                <p className="text-sm text-muted-foreground">Preview mode</p>
                <p className="mt-2 text-2xl font-semibold">Frontend only</p>
              </Card>
              <Card className="p-4 text-left">
                <p className="text-sm text-muted-foreground">Setup later</p>
                <p className="mt-2 text-2xl font-semibold">Backend optional</p>
              </Card>
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-xl space-y-8">
            <DemoBanner />

            <div className="text-center space-y-3">
              <h1 className="text-3xl font-bold tracking-tight">Frontend preview is ready</h1>
              <p className="text-muted-foreground">
                Choose a standalone view to explore the UI without backend setup.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Button className="h-16 text-base" onClick={() => onPick("student")}>
                <GraduationCap className="mr-2 h-5 w-5" />
                Open Student Preview
              </Button>
              <Button className="h-16 text-base" variant="outline" onClick={() => onPick("teacher")}>
                <Users className="mr-2 h-5 w-5" />
                Open Teacher Preview
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <Button variant="ghost" className="mb-6" onClick={onBack}>
      <ArrowLeft className="mr-2 h-4 w-4" />
      Back to role selection
    </Button>
  );
}

function ProctoringLab() {
  const { videoRef, modelReady, faces, cameraError } = useCameraProcessor(2);
  const [isBlur, setIsBlur] = useState("No");
  const [isFocused, setIsFocused] = useState(true);
  const [recognitions, setRecognitions] = useState<FaceRecognition[]>([]);
  const [behavior, setBehavior] = useState<FaceBehaviorStatus>(defaultBehavior);
  const [history, setHistory] = useState<FaceBehaviorStatus[]>([]);

  useEffect(() => {
    setHistory((current) => [...current.slice(-11), behavior]);
  }, [behavior]);

  const fatigueSummary = useMemo(() => {
    const sampleCount = history.length || 1;
    const lookingDownRatio = history.filter((entry) => entry.isLookingDown).length / sampleCount;
    const sleepyRatio = history.filter((entry) => entry.isSleepy).length / sampleCount;
    const yawningRatio = history.filter((entry) => entry.isYawning).length / sampleCount;
    const score = Number(
      Math.min(
        1,
        (behavior.fatigueScore || 0) + lookingDownRatio * 0.35 + sleepyRatio * 0.4 + yawningRatio * 0.25
      ).toFixed(2)
    );

    if (score >= 0.7) {
      return { label: "High fatigue", tone: "destructive", score };
    }
    if (score >= 0.4) {
      return { label: "Moderate fatigue", tone: "secondary", score };
    }
    return { label: "Attentive", tone: "outline", score };
  }, [behavior.fatigueScore, history]);

  const facePresent = recognitions.length > 0 || faces.length > 0 || behavior.eyeAspectRatio > 0;
  const detectedFacesCount = Math.max(faces.length, recognitions.length);
  const focusLabel = !facePresent ? "Lost" : isFocused ? "Centered" : "Lost";

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Live Proctoring Lab
        </CardTitle>
        <CardDescription>
          This uses the project&apos;s real webcam, face detection, blur detection, and face-landmark behavior checks.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <div className="relative aspect-video overflow-hidden rounded-2xl bg-slate-950">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            <FaceRecognitionOverlay recognitions={recognitions} videoRef={videoRef} />
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-white">
                <div className="max-w-md space-y-3">
                  <p className="font-semibold text-red-300">Camera could not start</p>
                  <p>{cameraError}</p>
                  <p className="text-xs text-slate-300">
                    Check the browser camera permission for `127.0.0.1` and make sure no other app is holding the webcam.
                  </p>
                </div>
              </div>
            )}
            {!modelReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm font-medium text-white">
                {cameraError ? "Camera blocked" : "Preparing camera analysis..."}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <ScanFace className="h-4 w-4" />
                  Faces
                </div>
                <p className="mt-2 text-2xl font-semibold">{detectedFacesCount}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Eye className="h-4 w-4" />
                  Looking down
                </div>
                <p className="mt-2 text-2xl font-semibold">{behavior.isLookingDown ? "Yes" : "No"}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <MoonStar className="h-4 w-4" />
                  Sleepy
                </div>
                <p className="mt-2 text-2xl font-semibold">{behavior.isSleepy ? "Yes" : "No"}</p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <BadgeAlert className="h-4 w-4" />
                  Blur
                </div>
                <p className="mt-2 text-2xl font-semibold">{isBlur}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Behavior Signals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Face present</span>
                <Badge variant={facePresent ? "default" : "secondary"}>{facePresent ? "Detected" : "Missing"}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Focus</span>
                <Badge variant={focusLabel === "Centered" ? "default" : "secondary"}>{focusLabel}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Looking down</span>
                <Badge variant={behavior.isLookingDown ? "secondary" : "outline"}>{behavior.isLookingDown ? "Detected" : "No"}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Yawning</span>
                <Badge variant={behavior.isYawning ? "secondary" : "outline"}>{behavior.isYawning ? "Detected" : "No"}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Slouching</span>
                <Badge variant={behavior.isSlouching ? "secondary" : "outline"}>{behavior.isSlouching ? "Detected" : "No"}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Fatigue</span>
                <Badge variant={fatigueSummary.tone as "default" | "secondary" | "outline" | "destructive"}>{fatigueSummary.label}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Live Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Eye aspect ratio</span>
                <span className="font-mono">{behavior.eyeAspectRatio.toFixed(3)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Mouth aspect ratio</span>
                <span className="font-mono">{behavior.mouthAspectRatio.toFixed(3)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Head-down score</span>
                <span className="font-mono">{behavior.headDownScore.toFixed(3)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Fatigue score</span>
                <span className="font-mono">{fatigueSummary.score.toFixed(2)}</span>
              </div>
              <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                This project is currently using TensorFlow.js and `face-api`, not OpenCV. The demo below is wired to the real
                in-repo webcam analysis path and exposes the existing posture/attention checks visually.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="hidden">
          <BlurDetection videoRef={videoRef} setIsBlur={setIsBlur} />
          <FaceDetectors
            faces={faces}
            setIsFocused={setIsFocused}
            videoRef={videoRef}
            onRecognitionResult={setRecognitions}
            onBehaviorResult={setBehavior}
            onMismatchChange={() => {}}
            demoMode={true}
            settings={{
              isFaceCountDetectionEnabled: true,
              isFaceRecognitionEnabled: true,
              isFocusEnabled: true,
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function StudentPreview({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <BackButton onBack={onBack} />
        <div className="mb-8 flex flex-col gap-4 rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="secondary" className="mb-3">Student Preview</Badge>
            <h1 className="text-3xl font-bold">Welcome back, Neha</h1>
            <p className="mt-2 text-slate-600">This is a frontend-only mock of the student dashboard.</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-slate-500">Courses</p>
                <p className="mt-1 text-2xl font-semibold">3</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-slate-500">Progress</p>
                <p className="mt-1 text-2xl font-semibold">73%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-slate-500">Alerts</p>
                <p className="mt-1 text-2xl font-semibold">2</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                My Courses
              </CardTitle>
              <CardDescription>Preview of course cards without live data.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {studentCourses.map((course) => (
                <div key={course.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold">{course.title}</p>
                      <p className="text-sm text-slate-500">{course.status}</p>
                    </div>
                    <Badge variant="outline">{course.progress}%</Badge>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-slate-200">
                    <div className="h-2 rounded-full bg-slate-900" style={{ width: `${course.progress}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-600">
                <div className="rounded-xl bg-slate-50 p-3">Quiz opens tomorrow at 10:00 AM.</div>
                <div className="rounded-xl bg-slate-50 p-3">Your project feedback is ready to review.</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Learning Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-600">
                <p>Strongest area: Communication Skills</p>
                <p>Needs attention: Discrete Mathematics</p>
                <p>Weekly streak: 5 days</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-6">
          <ProctoringLab />
        </div>
      </div>
    </div>
  );
}

function TeacherPreview({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-950">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <BackButton onBack={onBack} />
        <div className="mb-8 rounded-3xl bg-[linear-gradient(135deg,#111827,#1f2937)] p-8 text-white shadow-sm">
          <Badge className="mb-3 bg-white/15 text-white hover:bg-white/15">Teacher Preview</Badge>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Instructor workspace</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-200">
                A static preview of the teacher dashboard while backend integration is still pending.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-300">Courses</p>
                <p className="mt-1 text-2xl font-semibold">12</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-300">Students</p>
                <p className="mt-1 text-2xl font-semibold">269</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-300">Flags</p>
                <p className="mt-1 text-2xl font-semibold">7</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Course Health</CardTitle>
              <CardDescription>Mock instructor overview cards.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {teacherCourses.map((course) => (
                <div key={course.title} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4">
                  <div>
                    <p className="font-semibold">{course.title}</p>
                    <p className="text-sm text-stone-500">{course.learners} active learners</p>
                  </div>
                  <Badge variant={course.health === "Strong" ? "default" : "secondary"}>{course.health}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Today</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-stone-600">
                <div className="rounded-xl bg-stone-50 p-3">Review flagged quiz attempts</div>
                <div className="rounded-xl bg-stone-50 p-3">Publish one new announcement</div>
                <div className="rounded-xl bg-stone-50 p-3">Approve 4 enrollment requests</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-stone-600">
                <p>Average completion rate: 68%</p>
                <p>Most active cohort: Spring 2026</p>
                <p>Pending submissions: 14</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DemoApp() {
  const [view, setView] = useState<DemoView>("role");

  if (view === "student") {
    return <StudentPreview onBack={() => setView("role")} />;
  }

  if (view === "teacher") {
    return <TeacherPreview onBack={() => setView("role")} />;
  }

  return <RolePicker onPick={setView} />;
}
