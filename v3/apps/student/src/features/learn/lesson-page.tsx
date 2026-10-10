import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { ApiError, unwrap } from '@vibe/api';
import { ArrowLeftIcon, ArrowRightIcon, BadgeCheckIcon, CheckCircle2Icon, HandIcon, Loader2Icon, LockIcon, ShieldAlertIcon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { itemTypeMeta, ProgressBar } from '@/features/courses/course-ui';
import {
  courseKeys,
  useCourseVersion,
  useCurrentPath,
  useEnrollments,
  useEthicsConsent,
  useFaceReference,
  useProgressPercentage,
  type CurrentPath,
} from '@/features/courses/queries';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

import { CameraBubble, CameraRequired, useCameraPresence } from './camera-presence';
import { ConsentGate } from './consent-gate';
import { useBlurDetector } from './detectors/use-blur-detector';
import { FaceEnrollment } from './detectors/face-enrollment';
import { useFaceCountDetector } from './detectors/use-face-count-detector';
import { useFaceRecognition } from './detectors/use-face-recognition';
import { useGestureDetector } from './detectors/use-gesture-detector';
import { useThumbsUpChallenge } from './detectors/use-thumbs-up-challenge';
import { useVoiceDetector } from './detectors/use-voice-detector';
import {
  heartbeat,
  isDetectorEnabled,
  startItem,
  toSeconds,
  unsupportedDetectors,
  useCompleteItem,
  useCourseSettings,
  useLesson,
  youtubeId,
  type DetectorSetting,
  type LessonItem,
  type LessonRef,
} from './queries';
import { TRACKS, useCourseTrack, useFlatSyllabus, type Track } from './tracks';
import { QuizRunner } from './quiz';
import { useAfterQuizSubmit } from './quiz-api';
import { YouTubePlayer } from './youtube-player';

const HEARTBEAT_MS = 30_000;
const VIEWABLE = new Set(['VIDEO', 'BLOG']);
/** The backend's reply when a linear-progression course is opened out of order. */
const OUT_OF_ORDER = /do not match current progress/i;

type LessonProps = LessonRef & { track: Track };

export function LessonPage({ track, ...ref }: LessonProps) {
  const lesson = useLesson(ref);
  const consent = useEthicsConsent(ref.courseId, ref.versionId);
  const percentage = useProgressPercentage(ref.courseId, ref.versionId);
  // The green track saves certified progress, which only exists for STUDENT
  // enrollments (the backend never creates a Progress record for any other
  // role) — an instructor opening a green lesson hit a raw "Progress not
  // found" 404 the moment it tried to start the item.
  const enrollments = useEnrollments('active');
  const enrollmentRole = enrollments.data?.enrollments.find((e) => e.courseVersionId === ref.versionId)?.role;
  const [, rememberTrack] = useCourseTrack(ref.versionId);
  useEffect(() => rememberTrack(track), [track, rememberTrack]);

  const progress = percentage.data?.percentCompleted ?? 0;
  const frame = (body: ReactNode) => (
    <LessonFrame lessonRef={ref} track={track} title={lesson.data?.name} progress={progress}>
      {body}
    </LessonFrame>
  );

  if (lesson.isPending || consent.isPending || enrollments.isPending) {
    return frame(
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-10">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="aspect-video w-full rounded-2xl" />
      </div>,
    );
  }
  // In linear courses the backend refuses lessons the student hasn't reached (403).
  if (lesson.isError) {
    return frame(
      lesson.error instanceof ApiError && lesson.error.status === 403 ? (
        <LockedLesson lessonRef={ref} track={track} />
      ) : (
        <Notice title="We couldn’t open this lesson" lessonRef={ref}>
          {lesson.error.message}
        </Notice>
      ),
    );
  }
  if (!consent.data?.signed) return frame(<ConsentGate courseId={ref.courseId} versionId={ref.versionId} />);

  const item = lesson.data;
  const greenQuiz = track === 'green' && item.type === 'QUIZ';
  if (!VIEWABLE.has(item.type) && !greenQuiz) {
    return frame(
      <Notice title={`${itemTypeMeta(item.type).label} lessons aren’t available here yet`} lessonRef={ref}>
        {track === 'blue'
          ? 'Study mode is for watching and reading. Assessments count only in certified mode.'
          : 'This version of the app can open videos and readings so far.'}
      </Notice>,
    );
  }

  if (track === 'blue') return <BlueLesson key={ref.itemId} lessonRef={ref} item={item} progress={progress} />;

  // Green track tracks certified progress, which doesn't exist for a non-student
  // enrollment (e.g. an instructor) — only the blue track (no progress saved) works for them.
  if (enrollmentRole && enrollmentRole !== 'STUDENT') {
    return frame(
      <Notice title="Certified progress isn’t available here" lessonRef={ref}>
        You’re enrolled on this course as {enrollmentRole.toLowerCase()}, not a student, so certified mode’s progress tracking doesn’t apply to
        you. Switch to study mode to study this lesson.
      </Notice>,
    );
  }

  // Green: never run a proctored lesson without every one of its enabled detectors
  // (more are ported over time; see SUPPORTED_DETECTORS in queries.ts).
  const unsupported = unsupportedDetectors(item.proctoringDetectors);
  if (unsupported.length > 0) {
    return frame(
      <Notice title="This lesson is proctored" icon={<ShieldAlertIcon className="size-6" aria-hidden />} lessonRef={ref}>
        This lesson requires {unsupported.length === 1 ? 'a check' : 'checks'} ({unsupported.map((d) => d.detectorName).join(', ')}) that{' '}
        {unsupported.length === 1 ? "isn't" : "aren't"} available in this version of the app yet. You can still study it in study mode.
      </Notice>,
    );
  }
  return <GreenGate key={ref.itemId} lessonRef={ref} item={item} progress={progress} />;
}

/**
 * Green track: one lesson at a time, in order. Enforced here too, so it holds
 * even in courses whose backend linear-progression setting is off.
 */
function GreenGate({ lessonRef: ref, item, progress }: { lessonRef: LessonRef; item: LessonItem; progress: number }) {
  const path = useCurrentPath(ref.courseId, ref.versionId);
  const isCurrent = path.data?.item?.id === ref.itemId;
  const isLocked = !path.isPending && !item.isAlreadyWatched && !!path.data?.item && !isCurrent;
  // Hooks must run unconditionally — don't gate this call behind the early
  // returns below. Instead it takes its own `enabled` flag, so a lesson that's
  // still loading or locked never opens the camera for content it isn't showing.
  const { blocked, overlay } = useProctoring(item.proctoringDetectors, ref.courseId, ref.versionId, !path.isPending && !isLocked);

  if (path.isPending) return <LessonFrame lessonRef={ref} track="green" title={item.name} progress={progress}><Skeleton className="mx-auto mt-10 h-64 w-full max-w-3xl" /></LessonFrame>;
  if (isLocked) {
    return (
      <LessonFrame lessonRef={ref} track="green" title={item.name} progress={progress}>
        <LockedLesson lessonRef={ref} track="green" />
      </LessonFrame>
    );
  }

  return (
    <>
      {/* blocked only dims/disables interaction here — it does NOT stop playback on
          its own. Video pausing is wired explicitly (GreenLesson's `paused={blocked}`)
          precisely so a blocked lesson can't just keep playing to completion behind
          the overlay. */}
      <div className={cn(blocked && 'pointer-events-none select-none blur-sm')} aria-hidden={blocked}>
        {item.type === 'QUIZ' ? (
          <GreenQuiz lessonRef={ref} item={item} progress={progress} />
        ) : (
          <GreenLesson lessonRef={ref} item={item} progress={progress} blocked={blocked} />
        )}
      </div>
      {overlay}
    </>
  );
}

/**
 * Runs every proctoring detector this build supports for the duration of a
 * green-track lesson. Detectors not in SUPPORTED_DETECTORS (queries.ts) never
 * reach here — the caller already blocked the lesson for those. Returns
 * `blocked` (so the caller can both dim the UI and actually pause playback)
 * and `overlay` (the camera bubble / block notices / enrollment dialog to
 * render alongside, not inside, the dimmed content).
 */
function useProctoring(
  detectors: DetectorSetting[] | undefined,
  courseId: string,
  versionId: string,
  /** False while the lesson itself isn't being shown yet (still loading / locked) — no camera prompt for content the student can't see. */
  enabled: boolean,
): { blocked: boolean; overlay: ReactNode } {
  const needsCamera = enabled && isDetectorEnabled(detectors, 'cameraMic');
  const needsRightClickBlock = enabled && isDetectorEnabled(detectors, 'rightClickDisabled');
  const needsBlur = enabled && isDetectorEnabled(detectors, 'blurDetection');
  const needsGesture = enabled && isDetectorEnabled(detectors, 'handGestureDetection');
  const needsVoice = enabled && isDetectorEnabled(detectors, 'voiceDetection');
  const needsFaceCount = enabled && isDetectorEnabled(detectors, 'faceCountDetection');
  const needsFaceRecognition = enabled && isDetectorEnabled(detectors, 'faceRecognition');
  // Every detector below needs a live camera feed to analyse, even on courses
  // that didn't separately turn the cameraMic detector on.
  const needsCameraStream = needsCamera || needsBlur || needsGesture || needsVoice || needsFaceCount || needsFaceRecognition;
  const camera = useCameraPresence({ audio: true, enabled: needsCameraStream });
  const cameraReady = camera.state === 'on';

  // A hidden video element feeds the frame-capture loops below — separate
  // from CameraBubble's own self-view video, which isn't exposed as a ref.
  const captureRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (captureRef.current) captureRef.current.srcObject = camera.stream;
  }, [camera.stream]);

  const isBlurry = useBlurDetector(captureRef, needsBlur && cameraReady);
  const gesture = useGestureDetector(captureRef, needsGesture && cameraReady);
  useThumbsUpChallenge(gesture, needsGesture && cameraReady);
  const isSpeaking = useVoiceDetector(camera.stream, needsVoice && cameraReady);
  const faceCount = useFaceCountDetector(captureRef, needsFaceCount && cameraReady);

  const faceReference = useFaceReference(courseId, versionId);
  const referenceEmbedding = needsFaceRecognition ? faceReference.data?.faceEmbedding : undefined;
  const recognitionStatus = useFaceRecognition(captureRef, referenceEmbedding, needsFaceRecognition && cameraReady);
  const [retakingReference, setRetakingReference] = useState(false);

  useEffect(() => {
    if (!needsRightClickBlock) return;
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', onContextMenu);
    return () => document.removeEventListener('contextmenu', onContextMenu);
  }, [needsRightClickBlock]);

  useEffect(() => {
    if (!needsBlur) return;
    if (isBlurry) {
      toast.warning('Your camera view looks blurry', {
        id: 'blur-warning',
        description: 'Make sure your camera lens is clean and you’re in focus.',
        duration: Infinity,
      });
    } else {
      toast.dismiss('blur-warning');
    }
  }, [isBlurry, needsBlur]);

  useEffect(() => {
    if (!needsVoice) return;
    if (isSpeaking) {
      toast.message('Voice detected', { id: 'voice-warning', description: 'Keep your surroundings quiet during this lesson.' });
    } else {
      toast.dismiss('voice-warning');
    }
  }, [isSpeaking, needsVoice]);

  // Face recognition needs a saved reference before it can run at all.
  const needsEnrollment = needsFaceRecognition && faceReference.isSuccess && !faceReference.data.faceEmbedding;
  const showEnrollment = needsEnrollment || retakingReference;

  let blockNotice: { title: string; message: string; showRetake?: boolean } | null = null;
  if (needsFaceCount && faceCount !== null && faceCount !== 1) {
    blockNotice =
      faceCount === 0
        ? { title: 'No face detected', message: 'Make sure your face is clearly visible to the camera.' }
        : { title: 'Multiple faces detected', message: 'Only one person should be visible to the camera during this lesson.' };
  } else if (needsFaceRecognition && !showEnrollment && faceReference.data?.faceEmbedding && recognitionStatus !== 'matched') {
    blockNotice =
      recognitionStatus === 'mismatched'
        ? {
            title: 'Face doesn’t match',
            message: 'We couldn’t confirm this is you. Make sure you’re well-lit and facing the camera, or add a new reference photo.',
            showRetake: true,
          }
        : { title: 'Checking it’s you…', message: 'Face the camera directly in good light.' };
  }

  const blocked = (needsCameraStream && !cameraReady) || showEnrollment || blockNotice !== null;

  const overlay = (
    <>
      {needsCameraStream && (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- hidden frame source for detectors, not a media player */}
          <video ref={captureRef} autoPlay playsInline muted className="hidden" aria-hidden="true" />
          <CameraBubble stream={camera.stream} />
          <CameraRequired
            state={camera.state}
            onRetry={camera.retry}
            idleHint="This lesson is proctored and needs your camera and microphone on. Nothing is recorded or sent anywhere."
          />
        </>
      )}
      {cameraReady && showEnrollment && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 overflow-y-auto bg-background">
          <FaceEnrollment
            videoRef={captureRef}
            stream={camera.stream}
            courseId={courseId}
            versionId={versionId}
            onDone={() => {
              setRetakingReference(false);
              void faceReference.refetch();
            }}
          />
        </div>
      )}
      {cameraReady && !showEnrollment && blockNotice && (
        <BlockingNotice
          title={blockNotice.title}
          message={blockNotice.message}
          action={blockNotice.showRetake ? { label: 'Add a new reference photo', onClick: () => setRetakingReference(true) } : undefined}
        />
      )}
    </>
  );

  return { blocked, overlay };
}

/** Full-screen notice for a proctoring block that isn't "camera is off" (that's CameraRequired). */
function BlockingNotice({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="proctoring-block-title" className="fixed inset-0 z-50 grid place-items-center bg-background/80 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
        <ShieldAlertIcon className="mx-auto size-8 text-amber-600" aria-hidden />
        <h2 id="proctoring-block-title" className="mt-4 font-aleo text-xl">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {action && (
          <Button variant="outline" size="sm" className="mt-4" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Opens the next lesson the backend's progress points to (or the course page when done). */
function useGoToNext(ref: LessonRef) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useCallback(async () => {
    const path = unwrap(
      await api.GET('/api/users/progress/courses/{courseId}/versions/{versionId}/current-path', {
        params: { path: { courseId: ref.courseId, versionId: ref.versionId } },
      }),
    ) as unknown as CurrentPath;
    queryClient.setQueryData(courseKeys.currentPath(ref.courseId, ref.versionId), path);
    const next = path?.item;
    if (next && next.id !== ref.itemId && path.module && path.section) {
      await navigate({
        to: '/learn/$courseId/$versionId/$moduleId/$sectionId/$itemId',
        params: { courseId: ref.courseId, versionId: ref.versionId, moduleId: path.module.id, sectionId: path.section.id, itemId: next.id },
        search: { track: 'green' },
      });
    } else {
      if (!next) toast.success('You’ve finished every lesson in this course.');
      await navigate({ to: '/courses/$courseId/$versionId', params: { courseId: ref.courseId, versionId: ref.versionId } });
    }
  }, [navigate, queryClient, ref]);
}

/** Green-track quiz: the attempt's submission grades it and advances progress when passed. */
function GreenQuiz({ lessonRef: ref, item, progress }: { lessonRef: LessonRef; item: LessonItem; progress: number }) {
  const navigate = useNavigate();
  const goToNext = useGoToNext(ref);
  const refresh = useAfterQuizSubmit();
  const watchItem = useRef<Promise<string> | null>(null);
  const [answering, setAnswering] = useState(false);

  // Already-passed quizzes can be retaken for practice without touching progress.
  const ensureWatchItem = useCallback(async () => {
    if (item.isAlreadyWatched) return undefined;
    watchItem.current ??= startItem(ref);
    return watchItem.current;
  }, [item.isAlreadyWatched, ref]);

  return (
    <LessonFrame
      lessonRef={ref}
      track="green"
      title={item.name}
      progress={progress}
      exitWarning={
        answering
          ? 'Your answers haven’t been submitted yet, so they’ll be lost. This attempt has already started and counts towards your attempt limit.'
          : undefined
      }
    >
      <QuizRunner
        onAnsweringChange={setAnswering}
        lessonRef={ref}
        item={item}
        ensureWatchItem={ensureWatchItem}
        onPassed={async () => {
          await refresh();
          await goToNext();
        }}
        onExit={() => navigate({ to: '/courses/$courseId/$versionId', params: { courseId: ref.courseId, versionId: ref.versionId } })}
      />
    </LessonFrame>
  );
}

function GreenLesson({
  lessonRef: ref,
  item,
  progress,
  blocked,
}: {
  lessonRef: LessonRef;
  item: LessonItem;
  progress: number;
  /** A proctoring violation is in effect — actually pause the video (not just dim it) and stop counting watch time. */
  blocked: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const settings = useCourseSettings(ref.courseId, ref.versionId);
  const complete = useCompleteItem(ref);
  const watchItemId = useRef<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const alreadyDone = Boolean(item.isAlreadyWatched);

  // Open a watch-time record for items not completed yet.
  useEffect(() => {
    if (alreadyDone) return;
    let cancelled = false;
    startItem(ref)
      .then((id) => {
        if (!cancelled) watchItemId.current = id;
      })
      .catch((e: Error) => !cancelled && setStartError(e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref.itemId, alreadyDone]);

  // Keep it alive: readings while the tab is visible, videos while playing — in
  // either case, never while a proctoring violation is blocking the lesson.
  const active = !blocked && (item.type === 'VIDEO' ? playing : true);
  useEffect(() => {
    if (!active || alreadyDone) return;
    const id = window.setInterval(() => {
      if (watchItemId.current && document.visibilityState === 'visible') void heartbeat(watchItemId.current, ref.itemId);
    }, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [active, alreadyDone, ref.itemId]);

  const ready = alreadyDone || (item.type === 'VIDEO' ? videoEnded : true);

  const goNext = useCallback(async () => {
    setFinishing(true);
    try {
      if (!alreadyDone) {
        if (!watchItemId.current) throw new Error(startError ?? 'The lesson hasn’t finished starting. Please try again.');
        await complete.mutateAsync(watchItemId.current);
      }
      const path = unwrap(
        await api.GET('/api/users/progress/courses/{courseId}/versions/{versionId}/current-path', {
          params: { path: { courseId: ref.courseId, versionId: ref.versionId } },
        }),
      ) as unknown as CurrentPath;
      queryClient.setQueryData(courseKeys.currentPath(ref.courseId, ref.versionId), path);
      const next = path?.item;
      if (next && next.id !== ref.itemId && path.module && path.section) {
        await navigate({
          to: '/learn/$courseId/$versionId/$moduleId/$sectionId/$itemId',
          params: { courseId: ref.courseId, versionId: ref.versionId, moduleId: path.module.id, sectionId: path.section.id, itemId: next.id },
          search: { track: 'green' },
        });
      } else {
        if (!next) toast.success('You’ve finished every lesson in this course.');
        await navigate({ to: '/courses/$courseId/$versionId', params: { courseId: ref.courseId, versionId: ref.versionId } });
      }
    } catch (e) {
      toast.error((e as Error).message || 'Couldn’t save your progress. Please try again.');
    } finally {
      setFinishing(false);
    }
  }, [alreadyDone, complete, navigate, queryClient, ref, startError]);

  if (startError && OUT_OF_ORDER.test(startError)) {
    return (
      <LessonFrame lessonRef={ref} track="green" title={item.name} progress={progress}>
        <LockedLesson lessonRef={ref} track="green" />
      </LessonFrame>
    );
  }

  return (
    <LessonFrame
      lessonRef={ref}
      track="green"
      title={item.name}
      progress={progress}
      footerTone={alreadyDone || (ready && item.type === 'VIDEO') ? 'success' : 'neutral'}
      footerLayout="stack"
      exitWarning={alreadyDone ? undefined : 'This lesson only counts once you finish it. If you leave now, you’ll start it again next time.'}
      footer={
        <>
          <p className="text-center text-sm text-muted-foreground empty:hidden sm:text-left" aria-live="polite">
            {alreadyDone ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2Icon className="size-4" aria-hidden /> Completed
              </span>
            ) : startError ? (
              <span className="text-destructive">{startError}</span>
            ) : item.type === 'VIDEO' && !videoEnded ? (
              'Watch to the end to continue'
            ) : null}
          </p>
          <Button size="lg" className="h-11 w-full sm:h-10 sm:w-auto" onClick={goNext} disabled={!ready || finishing || Boolean(startError && !alreadyDone)}>
            {finishing && <Loader2Icon className="animate-spin" />}
            Continue
          </Button>
        </>
      }
    >
      <LessonContent
        item={item}
        allowSeekForward={(settings.data?.settings.seekForwardEnabled ?? false) || alreadyDone}
        paused={blocked}
        onPlayingChange={setPlaying}
        onEnded={() => setVideoEnded(true)}
      />
    </LessonFrame>
  );
}

/**
 * Blue track: study mode. Any lesson the backend will serve, free seeking,
 * previous/next through the syllabus. Camera must be on; nothing is detected,
 * reported or saved — no start/stop/heartbeat calls at all.
 */
function BlueLesson({ lessonRef: ref, item, progress }: { lessonRef: LessonRef; item: LessonItem; progress: number }) {
  const camera = useCameraPresence();
  const version = useCourseVersion(ref.versionId);
  const { items } = useFlatSyllabus(version.data);
  const index = items.findIndex((i) => i._id === ref.itemId);
  const prev = index > 0 ? items[index - 1] : undefined;
  const next = index >= 0 ? items[index + 1] : undefined;
  const blocked = camera.state !== 'on';

  const linkTo = (target: (typeof items)[number]) => ({
    to: '/learn/$courseId/$versionId/$moduleId/$sectionId/$itemId' as const,
    params: { courseId: ref.courseId, versionId: ref.versionId, moduleId: target.moduleId, sectionId: target.sectionId, itemId: target._id },
    search: { track: 'blue' as const },
  });

  return (
    <LessonFrame
      lessonRef={ref}
      track="blue"
      title={item.name}
      progress={progress}
      footer={
        <>
          {prev ? (
            <Link {...linkTo(prev)} className={buttonVariants({ variant: 'ghost' })}>
              <ArrowLeftIcon data-icon="inline-start" /> Previous
            </Link>
          ) : (
            <span />
          )}
          <p className="hidden text-xs text-muted-foreground sm:block">Study mode · not saved to your progress</p>
          {next ? (
            <Link {...linkTo(next)} className={buttonVariants({ size: 'lg' })}>
              Next <ArrowRightIcon data-icon="inline-end" />
            </Link>
          ) : (
            <Link to="/courses/$courseId/$versionId" params={{ courseId: ref.courseId, versionId: ref.versionId }} className={buttonVariants({ size: 'lg' })}>
              Back to the course
            </Link>
          )}
        </>
      }
    >
      <div className={cn(blocked && 'pointer-events-none select-none blur-sm')} aria-hidden={blocked}>
        <LessonContent item={item} allowSeekForward paused={blocked} />
      </div>
      <CameraBubble stream={camera.stream} />
      <CameraRequired
        state={camera.state}
        onRetry={camera.retry}
        idleHint="Study mode only needs your camera on. Nothing is recorded or analysed."
      />
    </LessonFrame>
  );
}

function LessonContent({
  item,
  allowSeekForward,
  paused,
  onPlayingChange,
  onEnded,
}: {
  item: LessonItem;
  allowSeekForward: boolean;
  paused?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  onEnded?: () => void;
}) {
  const videoId = item.type === 'VIDEO' ? youtubeId(item.details.URL) : null;
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{itemTypeMeta(item.type).label}</p>
      <h1 className="mt-1 font-aleo text-2xl tracking-tight sm:text-3xl">{item.name}</h1>
      {item.description && item.description !== item.name && <p className="mt-2 text-muted-foreground">{item.description}</p>}
      <div className="mt-6">
        {item.type === 'VIDEO' &&
          (videoId ? (
            <YouTubePlayer
              videoId={videoId}
              start={toSeconds(item.details.startTime)}
              end={toSeconds(item.details.endTime)}
              allowSeekForward={allowSeekForward}
              paused={paused}
              onPlayingChange={onPlayingChange}
              onEnded={onEnded}
            />
          ) : (
            <p className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">
              This video is hosted on ViBe’s own storage, which this version of the app can’t play yet.
            </p>
          ))}
        {item.type === 'BLOG' && (
          <div className="prose-vibe">
            <Markdown remarkPlugins={[remarkGfm]}>{item.details.content ?? ''}</Markdown>
            {item.details.estimatedReadTimeInMinutes ? (
              <p className="mt-8 text-xs text-muted-foreground">About {item.details.estimatedReadTimeInMinutes} min read</p>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}

/** Blue / green track ticks, using the shadcn Badge with custom colours. */
const TRACK_BADGE: Record<Track, string> = {
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  green: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
};

export function TrackBadge({ track, className }: { track: Track; className?: string }) {
  return (
    <Badge className={cn(TRACK_BADGE[track], className)}>
      <BadgeCheckIcon data-icon="inline-start" aria-hidden />
      {TRACKS[track].label}
    </Badge>
  );
}

/**
 * Uxcel lesson frame: close, course progress and track on top; sticky action
 * bar below. On phones the bar stacks its hint above a full-width button and
 * both bars respect the safe areas.
 */
function LessonFrame({
  lessonRef: ref,
  track,
  title,
  progress,
  children,
  footer,
  footerTone = 'neutral',
  footerLayout = 'row',
  exitWarning,
}: {
  lessonRef: LessonRef;
  track: Track;
  title?: string;
  progress: number;
  children: ReactNode;
  footer?: ReactNode;
  footerTone?: 'neutral' | 'success';
  footerLayout?: 'row' | 'stack';
  /** When set, closing the lesson asks first (Uxcel's "Hold it right there!"). */
  exitWarning?: string;
}) {
  const other: Track = track === 'blue' ? 'green' : 'blue';
  const navigate = useNavigate();
  const [confirmExit, setConfirmExit] = useState(false);
  const course = { to: '/courses/$courseId/$versionId' as const, params: { courseId: ref.courseId, versionId: ref.versionId } };
  const closeClass = 'grid size-10 shrink-0 place-items-center rounded-md hover:bg-muted';

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header
        className={cn(
          'sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-md',
          track === 'blue' ? 'border-sky-500/30' : 'border-emerald-500/30',
        )}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          {exitWarning ? (
            <button type="button" aria-label="Close lesson" onClick={() => setConfirmExit(true)} className={closeClass}>
              <XIcon className="size-5" />
            </button>
          ) : (
            <Link {...course} aria-label="Close lesson" className={closeClass}>
              <XIcon className="size-5" />
            </Link>
          )}
          <ProgressBar value={progress} className="h-2 flex-1" label="Certified progress" />
          <span className="hidden max-w-52 truncate text-sm text-muted-foreground md:inline">{title}</span>
          <TrackBadge track={track} />
          <Link
            to="/learn/$courseId/$versionId/$moduleId/$sectionId/$itemId"
            params={ref}
            search={{ track: other }}
            className="hidden text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:inline"
          >
            Switch to {TRACKS[other].label.toLowerCase()}
          </Link>
        </div>
      </header>
      <main id="main" className={cn('flex flex-1 flex-col', footer ? 'pb-[calc(9rem+env(safe-area-inset-bottom))] sm:pb-24' : 'pb-[env(safe-area-inset-bottom)]')}>
        {children}
      </main>
      {footer && (
        <footer
          className={cn(
            'fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md',
            footerTone === 'success' ? 'border-emerald-600/20 bg-emerald-50/90 dark:bg-emerald-950/60' : 'border-border bg-muted/70',
          )}
        >
          <div
            className={cn(
              'mx-auto flex max-w-5xl gap-4 px-4 py-3',
              footerLayout === 'stack' ? 'flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4' : 'items-center justify-between',
            )}
          >
            {footer}
          </div>
        </footer>
      )}

      <Sheet open={confirmExit} onOpenChange={setConfirmExit}>
        <SheetContent side="bottom" showCloseButton={false} className="mx-auto max-w-lg gap-0 rounded-t-2xl px-5 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center sm:bottom-6 sm:rounded-2xl sm:border">
          <span aria-hidden className="mx-auto grid size-14 place-items-center rounded-full bg-primary/15 text-primary">
            <HandIcon className="size-7" />
          </span>
          <SheetTitle className="mt-4 font-aleo text-2xl">Hold it right there!</SheetTitle>
          <SheetDescription className="mt-2">{exitWarning}</SheetDescription>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" className="h-11" onClick={() => void navigate(course)}>
              Leave lesson
            </Button>
            <Button size="lg" className="h-11" autoFocus onClick={() => setConfirmExit(false)}>
              Keep learning
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LockedLesson({ lessonRef: ref, track }: { lessonRef: LessonRef; track: Track }) {
  const path = useCurrentPath(ref.courseId, ref.versionId);
  const next = path.data;
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
        <LockIcon className="size-6" aria-hidden />
      </span>
      <h1 className="font-aleo text-2xl tracking-tight">{track === 'blue' ? 'Not unlocked yet' : 'Finish the earlier lessons first'}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {track === 'blue'
          ? 'This course unlocks lessons as you complete them in certified mode. Lessons you’ve already reached are open for study.'
          : 'Certified mode goes one lesson at a time, in order.'}
      </p>
      {next?.item && next.module && next.section ? (
        <Link
          to="/learn/$courseId/$versionId/$moduleId/$sectionId/$itemId"
          params={{ courseId: ref.courseId, versionId: ref.versionId, moduleId: next.module.id, sectionId: next.section.id, itemId: next.item.id }}
          search={{ track: 'green' }}
          className={cn(buttonVariants(), 'mt-6')}
        >
          Go to your next lesson: {next.item.name}
        </Link>
      ) : (
        <Link to="/courses/$courseId/$versionId" params={{ courseId: ref.courseId, versionId: ref.versionId }} className={cn(buttonVariants({ variant: 'outline' }), 'mt-6')}>
          Back to the course
        </Link>
      )}
    </div>
  );
}

function Notice({ title, icon, children, lessonRef: ref }: { title: string; icon?: ReactNode; children: ReactNode; lessonRef: LessonRef }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      {icon && <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">{icon}</span>}
      <h1 className="font-aleo text-2xl tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
      <Link
        to="/courses/$courseId/$versionId"
        params={{ courseId: ref.courseId, versionId: ref.versionId }}
        className={cn(buttonVariants({ variant: 'outline' }), 'mt-6')}
      >
        Back to the course
      </Link>
    </div>
  );
}
