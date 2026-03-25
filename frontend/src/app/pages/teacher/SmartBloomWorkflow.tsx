import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { aiSectionAPI, connectToLiveStatusUpdates, getApiUrl } from "@/lib/genai-api";
import { useCourseStore } from "@/store/course-store";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, BookOpen, BrainCircuit, Check, CheckCircle, ChevronLeft, ChevronRight, FlaskConical, Loader2, Pencil, X, XCircle } from "lucide-react";
import { cn } from "@/utils/utils";

type BloomKey =
  | "knowledge"
  | "understanding"
  | "application"
  | "analysis"
  | "evaluation"
  | "creation";

type BloomDistribution = Record<BloomKey, number>;
type OptionalBloomKey = "analysis" | "evaluation" | "creation";

const REQUIRED_BLOOM_KEYS: BloomKey[] = ["knowledge", "understanding", "application"];
const OPTIONAL_BLOOM_KEYS: OptionalBloomKey[] = ["analysis", "evaluation", "creation"];

const BLOOM_LEVEL_META: Record<BloomKey, { label: string; description: string }> = {
  knowledge: { label: "Knowledge", description: "Recall, identify, define" },
  understanding: { label: "Understanding", description: "Explain, compare, interpret" },
  application: { label: "Application", description: "Apply concepts in scenarios" },
  analysis: { label: "Analysis", description: "Break down, relate, examine" },
  evaluation: { label: "Evaluation", description: "Judge, justify, critique" },
  creation: { label: "Creation", description: "Design, build, synthesize" },
};

type BloomPreset = {
  id: "classic-3" | "full-6-balanced" | "higher-order-heavy";
  label: string;
  enabledOptional: Record<OptionalBloomKey, boolean>;
  distribution: BloomDistribution;
};

const BLOOM_PRESETS: BloomPreset[] = [
  {
    id: "classic-3",
    label: "Classic 3-Level",
    enabledOptional: { analysis: false, evaluation: false, creation: false },
    distribution: {
      knowledge: 40,
      understanding: 35,
      application: 25,
      analysis: 0,
      evaluation: 0,
      creation: 0,
    },
  },
  {
    id: "full-6-balanced",
    label: "Full 6-Level Balanced",
    enabledOptional: { analysis: true, evaluation: true, creation: true },
    distribution: {
      knowledge: 17,
      understanding: 17,
      application: 17,
      analysis: 17,
      evaluation: 16,
      creation: 16,
    },
  },
  {
    id: "higher-order-heavy",
    label: "Higher-Order Heavy",
    enabledOptional: { analysis: true, evaluation: true, creation: true },
    distribution: {
      knowledge: 10,
      understanding: 15,
      application: 20,
      analysis: 20,
      evaluation: 17,
      creation: 18,
    },
  },
];

type PipelineStep =
  | "IDLE"
  | "AUDIO_EXTRACTION"
  | "TRANSCRIPT_GENERATION"
  | "SEGMENTATION"
  | "QUESTION_GENERATION"
  | "CURATION_READY"
  | "UPLOAD_CONTENT"
  | "COMPLETED";

interface CuratedQuestion {
  id: string;
  segmentId: number;
  bloomLevel?: BloomKey | 'unclassified';
  text: string;
  options: string[];
  raw: any;
}

const MIN_ACTIVE_QUESTIONS_PER_SEGMENT = 15;
const MIN_SEGMENT_DURATION_SECONDS = 120; // 2 min minimum for quiz-worthy coverage

const normalizeOptionText = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

const uniqueOptions = (values: unknown[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  values.forEach((value) => {
    const normalized = normalizeOptionText(value);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  });
  return out;
};

const clampToNumber = (value: string, min = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, parsed);
};

const normalizePercentages = (distribution: BloomDistribution, activeKeys: BloomKey[]): BloomDistribution => {
  const entries = activeKeys.map((key) => [key, distribution[key]] as [BloomKey, number]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  const normalized: BloomDistribution = {
    knowledge: 0,
    understanding: 0,
    application: 0,
    analysis: 0,
    evaluation: 0,
    creation: 0,
  };

  if (total <= 0) {
    if (activeKeys.length === 0) return normalized;
    const base = Math.floor(100 / activeKeys.length);
    let remainder = 100 - base * activeKeys.length;
    activeKeys.forEach((key, idx) => {
      normalized[key] = base + (idx < remainder ? 1 : 0);
    });
    return normalized;
  }

  const scaled = entries.map(([key, value]) => ({ key, raw: (value / total) * 100 }));
  const floored = scaled.map(({ key, raw }) => ({ key, value: Math.floor(raw), remainder: raw - Math.floor(raw) }));

  let remaining = 100 - floored.reduce((sum, item) => sum + item.value, 0);

  floored.sort((a, b) => b.remainder - a.remainder);

  for (let i = 0; i < floored.length && remaining > 0; i += 1) {
    floored[i].value += 1;
    remaining -= 1;
  }

  floored.forEach((item) => {
    normalized[item.key] = item.value;
  });

  return normalized;
};

const allocateQuestions = (
  totalQuestions: number,
  distribution: BloomDistribution,
  activeKeys: BloomKey[],
): Record<BloomKey, number> => {
  const entries = activeKeys.map((key) => [key, distribution[key]] as [BloomKey, number]);
  const weighted = entries.map(([key, percentage]) => {
    const expected = (totalQuestions * percentage) / 100;
    return {
      key,
      base: Math.floor(expected),
      remainder: expected - Math.floor(expected),
    };
  });

  const allocations = weighted.reduce(
    (acc, item) => {
      acc[item.key] = item.base;
      return acc;
    },
    {
      knowledge: 0,
      understanding: 0,
      application: 0,
      analysis: 0,
      evaluation: 0,
      creation: 0,
    } as Record<BloomKey, number>,
  );

  let remaining = totalQuestions - Object.values(allocations).reduce((sum, value) => sum + value, 0);

  weighted
    .slice()
    .sort((a, b) => b.remainder - a.remainder)
    .forEach((item) => {
      if (remaining > 0) {
        allocations[item.key] += 1;
        remaining -= 1;
      }
    });

  return allocations;
};

interface SmartBloomWorkflowProps {
  onUploadComplete?: (moduleId: string, sectionId: string) => void;
}

const SmartBloomWorkflow = ({ onUploadComplete }: SmartBloomWorkflowProps = {}) => {
  const { currentCourse } = useCourseStore();
  const queryClient = useQueryClient();
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRefilling, setIsRefilling] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const [segmentationStrategy, setSegmentationStrategy] = useState<"DEFAULT" | "CONCEPT_END">("CONCEPT_END");
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>("IDLE");
  const [totalQuestions, setTotalQuestions] = useState<number>(10);
  const [distribution, setDistribution] = useState<BloomDistribution>({
    knowledge: 40,
    understanding: 35,
    application: 25,
    analysis: 0,
    evaluation: 0,
    creation: 0,
  });
  const [optionalBloomEnabled, setOptionalBloomEnabled] = useState<Record<OptionalBloomKey, boolean>>({
    analysis: false,
    evaluation: false,
    creation: false,
  });
  const [questions, setQuestions] = useState<CuratedQuestion[]>([]);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [questionIndexBySegment, setQuestionIndexBySegment] = useState<Record<number, number>>({});
  const [acceptedQuestionIds, setAcceptedQuestionIds] = useState<Set<string>>(new Set());
  const [rejectedQuestionIds, setRejectedQuestionIds] = useState<Set<string>>(new Set());
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editCorrectOptionIndexes, setEditCorrectOptionIndexes] = useState<number[]>([]);

  // Pipeline feedback state
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [segmentCount, setSegmentCount] = useState<number | null>(null);
  const [revealedSegmentCount, setRevealedSegmentCount] = useState(0);

  // Curation animation state
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const [isNewQuestionEntering, setIsNewQuestionEntering] = useState(false);

  // SSE refs — stable across renders
  const sseRef = useRef<EventSource | null>(null);
  const sseListenersRef = useRef<Map<string, (data: any) => void>>(new Map());

  // Tear down SSE when component unmounts
  useEffect(() => {
    return () => {
      sseRef.current?.close();
      sseRef.current = null;
      sseListenersRef.current.clear();
    };
  }, []);

  const activeBloomKeys = useMemo(() => {
    const optionalEnabled = OPTIONAL_BLOOM_KEYS.filter((key) => optionalBloomEnabled[key]);
    return [...REQUIRED_BLOOM_KEYS, ...optionalEnabled];
  }, [optionalBloomEnabled]);

  const distributionSum = useMemo(
    () => activeBloomKeys.reduce((sum, key) => sum + distribution[key], 0),
    [distribution, activeBloomKeys],
  );

  const questionBreakdown = useMemo(
    () => allocateQuestions(totalQuestions, distribution, activeBloomKeys),
    [distribution, totalQuestions, activeBloomKeys],
  );

  const handleDistributionChange = (key: BloomKey, value: string) => {
    if (!REQUIRED_BLOOM_KEYS.includes(key) && !optionalBloomEnabled[key as OptionalBloomKey]) {
      return;
    }
    const nextValue = clampToNumber(value, 0);
    setDistribution((prev) => ({ ...prev, [key]: nextValue }));
  };

  const handleNormalize = () => {
    setDistribution((prev) => normalizePercentages(prev, activeBloomKeys));
  };

  const toggleOptionalBloomLevel = (key: OptionalBloomKey) => {
    setOptionalBloomEnabled((prev) => {
      const nextEnabled = !prev[key];
      if (!nextEnabled) {
        setDistribution((distPrev) => ({ ...distPrev, [key]: 0 }));
      }
      return { ...prev, [key]: nextEnabled };
    });
  };

  const applyBloomPreset = (preset: BloomPreset) => {
    setOptionalBloomEnabled(preset.enabledOptional);
    setDistribution(preset.distribution);
  };

  const segmentIds = useMemo(() => {
    const unique = new Set<number>();
    questions.forEach((q) => unique.add(q.segmentId));
    return Array.from(unique).sort((a, b) => a - b);
  }, [questions]);

  const currentSegmentId = segmentIds[activeSegmentIndex] ?? 0;
  const currentAllSegmentQuestions = useMemo(
    () => questions.filter((q) => q.segmentId === currentSegmentId),
    [currentSegmentId, questions],
  );

  const currentSegmentQuestionIndex = questionIndexBySegment[currentSegmentId] ?? 0;
  const currentQuestion =
    currentAllSegmentQuestions[Math.min(currentSegmentQuestionIndex, Math.max(0, currentAllSegmentQuestions.length - 1))] ?? null;

  const acceptedCount = acceptedQuestionIds.size;

  const isAcceptedQ = (id: string) => acceptedQuestionIds.has(id);
  const isRejectedQ = (id: string) => rejectedQuestionIds.has(id);
  const isDecidedQ = (id: string) => acceptedQuestionIds.has(id) || rejectedQuestionIds.has(id);

  const currentSegmentAcceptedCount = useMemo(
    () => currentAllSegmentQuestions.filter((q) => acceptedQuestionIds.has(q.id)).length,
    [currentAllSegmentQuestions, acceptedQuestionIds],
  );

  const currentSegmentRejectedCount = useMemo(
    () => currentAllSegmentQuestions.filter((q) => rejectedQuestionIds.has(q.id)).length,
    [currentAllSegmentQuestions, rejectedQuestionIds],
  );

  const canProceed = useMemo(() => {
    const revealedSids = segmentIds.slice(0, revealedSegmentCount);
    return revealedSids.length > 0 && revealedSids.every((segId) =>
      questions.some((q) => q.segmentId === segId && acceptedQuestionIds.has(q.id)),
    );
  }, [segmentIds, questions, acceptedQuestionIds, revealedSegmentCount]);

  const normalizeQuestionPayload = (data: any): CuratedQuestion[] => {
    const normalizeBloomLevel = (value: unknown): BloomKey | 'unclassified' => {
      const normalized = String(value ?? '').trim().toLowerCase();
      if (
        normalized === 'knowledge' ||
        normalized === 'understanding' ||
        normalized === 'application' ||
        normalized === 'analysis' ||
        normalized === 'evaluation' ||
        normalized === 'creation'
      ) {
        return normalized as BloomKey;
      }
      return 'unclassified';
    };

    const buildQuestion = (item: any, fallbackSegment: number, indexSeed: number): CuratedQuestion => {
      const questionText = item?.question?.text ?? item?.text ?? item?.question ?? "";
      const explicitOptions = Array.isArray(item?.options) ? item.options : [];
      const solutionOptions = item?.solution?.correctLotItem || item?.solution?.correctLotItems
        ? [
            ...(item?.solution?.correctLotItems || (item?.solution?.correctLotItem ? [item.solution.correctLotItem] : [])).map((o: any) => o?.text),
            ...((item?.solution?.incorrectLotItems || []).map((o: any) => o?.text)),
          ]
        : [];
      const baseOptions = uniqueOptions([...explicitOptions, ...solutionOptions]);
      const segmentId = Number(item?.segmentId ?? item?.segment ?? fallbackSegment);
      const stableId = `${segmentId}-${(questionText || "q").slice(0, 32)}-${indexSeed}`;
      return {
        id: stableId,
        segmentId: Number.isFinite(segmentId) ? segmentId : fallbackSegment,
        bloomLevel: normalizeBloomLevel(item?.bloomLevel ?? item?.question?.bloomLevel),
        text: questionText,
        options: baseOptions.filter(Boolean),
        raw: item,
      };
    };

    if (Array.isArray(data)) {
      return data.map((q, idx) => buildQuestion(q, Number(q?.segmentId ?? 0), idx));
    }

    if (Array.isArray(data?.segments)) {
      const flat: CuratedQuestion[] = [];
      data.segments.forEach((segment: any, segIdx: number) => {
        const possible = Array.isArray(segment?.questions)
          ? segment.questions
          : Array.isArray(segment)
            ? segment
            : [];
        possible.forEach((q: any, qIdx: number) => {
          flat.push(buildQuestion(q, segIdx, segIdx * 1000 + qIdx));
        });
      });
      return flat;
    }

    return [];
  };

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setStatusLog((prev) => [...prev.slice(-24), `[${time}] ${msg}`]);
  };

  const disconnectSSE = () => {
    sseRef.current?.close();
    sseRef.current = null;
    sseListenersRef.current.clear();
  };

  const connectSSE = (jobId: string) => {
    disconnectSSE();
    const es = connectToLiveStatusUpdates(jobId, (rawEvent: any) => {
      const taskKey = rawEvent?.task as string | undefined;
      if (!taskKey) return;
      if (rawEvent.status === "RUNNING") {
        addLog(`${taskKey.replace(/_/g, " ").toLowerCase()} is running…`);
      }
      const cb = sseListenersRef.current.get(taskKey);
      if (cb) cb(rawEvent);
    });
    sseRef.current = es;
  };

  const taskKeyToStatusKey = (
    taskKey: string,
  ): keyof NonNullable<Awaited<ReturnType<typeof aiSectionAPI.getJobStatus>>["jobStatus"]> | null => {
    if (taskKey === "AUDIO_EXTRACTION") return "audioExtraction";
    if (taskKey === "TRANSCRIPT_GENERATION") return "transcriptGeneration";
    if (taskKey === "SEGMENTATION") return "segmentation";
    if (taskKey === "QUESTION_GENERATION") return "questionGeneration";
    if (taskKey === "UPLOAD_CONTENT") return "uploadContent";
    return null;
  };

  // Resolves on task completion using SSE + periodic polling fallback.
  const waitForSSEEvent = async (jobId: string, taskKey: string, timeoutMs = 12 * 60 * 1000, skipPrecheck = false): Promise<any> => {
    const statusKey = taskKeyToStatusKey(taskKey);
    if (statusKey && !skipPrecheck) {
      const status = await aiSectionAPI.getJobStatus(jobId);
      const current = status.jobStatus?.[statusKey];
      if (current === "COMPLETED") {
        addLog(`${taskKey.replace(/_/g, " ").toLowerCase()} already completed`);
        return { task: taskKey, status: "COMPLETED" };
      }
      if (current === "FAILED") {
        throw new Error(`${taskKey} failed`);
      }
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      let lastKnownState: string | undefined;

      const cleanup = () => {
        settled = true;
        clearTimeout(timeoutId);
        clearInterval(pollId);
        sseListenersRef.current.delete(taskKey);
      };

      const finishResolve = (payload: any) => {
        if (settled) return;
        cleanup();
        resolve(payload);
      };

      const finishReject = (error: Error) => {
        if (settled) return;
        cleanup();
        reject(error);
      };

      const checkStatus = async (source: "poll" | "timeout") => {
        if (!statusKey || settled) return;
        try {
          const status = await aiSectionAPI.getJobStatus(jobId);
          const current = status.jobStatus?.[statusKey];
          if (current && current !== lastKnownState) {
            lastKnownState = current;
            addLog(`${taskKey.replace(/_/g, " ").toLowerCase()} status: ${current.toLowerCase()} (${source})`);
          }
          if (current === "COMPLETED") {
            finishResolve({ task: taskKey, status: "COMPLETED" });
            return;
          }
          if (current === "FAILED") {
            finishReject(new Error(`${taskKey} failed`));
          }
        } catch (err) {
          // Keep waiting on transient polling failures.
          console.warn(`Status poll failed for ${taskKey}:`, err);
        }
      };

      const timeoutId = window.setTimeout(async () => {
        await checkStatus("timeout");
        if (!settled) {
          finishReject(new Error(`Timeout waiting for ${taskKey}`));
        }
      }, timeoutMs);

      const pollId = window.setInterval(() => {
        void checkStatus("poll");
      }, 5000);

      // Start polling immediately; do not wait for first interval tick.
      void checkStatus("poll");

      sseListenersRef.current.set(taskKey, (data: any) => {
        if (data.status === "RUNNING") {
          const state = "running";
          if (lastKnownState !== "RUNNING") {
            lastKnownState = "RUNNING";
            addLog(`${taskKey.replace(/_/g, " ").toLowerCase()} status: ${state} (sse)`);
          }
          return;
        }
        if (data.status === "FAILED") {
          finishReject(new Error(`${taskKey} failed`));
          return;
        }
        if (data.status === "COMPLETED") {
          finishResolve(data);
        }
      });
    });
  };

  const fetchLatestQuestionResults = async (jobId: string, directFileUrl?: string): Promise<CuratedQuestion[]> => {
    let fileUrl = directFileUrl;

    if (!fileUrl) {
      // Fallback: query the task status endpoint for the file URL
      const token = localStorage.getItem("firebase-auth-token");
      if (!token) throw new Error("Authentication token missing");
      const statusUrl = getApiUrl(`/genai/${jobId}/tasks/QUESTION_GENERATION/status`);
      const statusRes = await fetch(statusUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!statusRes.ok) throw new Error("Failed to fetch generated question status");
      const payload = await statusRes.json();
      const latest = Array.isArray(payload) ? payload[payload.length - 1] : payload;
      if (!latest?.fileUrl) throw new Error("Question file URL not found");
      fileUrl = latest.fileUrl;
    }

    const fileRes = await fetch(fileUrl!);
    if (!fileRes.ok) throw new Error("Failed to fetch question file");
    const fileJson = await fileRes.json();
    return normalizeQuestionPayload(fileJson);
  };

  const getQuestionGenerationParams = (numQuestions: number) => ({
    SOL: numQuestions,
    SML: 0,
    NAT: 0,
    DES: 0,
    numberOfQuestions: numQuestions,
    prompt:
      "Generate scenario-based, situational questions that test real understanding. " +
      "Each question should present a realistic context or mini-scenario relevant to the segment topic, " +
      "making students apply concepts rather than just recall definitions.",
    smartBloom: {
      enabled: true,
      segmentationStrategy,
      distribution,
    },
  });

  const mergeQuestions = (incoming: CuratedQuestion[]) => {
    setQuestions((prev) => {
      const seen = new Set(prev.map((q) => `${q.segmentId}::${q.bloomLevel ?? 'unclassified'}::${q.text}`));
      const next = [...prev];
      incoming.forEach((q) => {
        const key = `${q.segmentId}::${q.bloomLevel ?? 'unclassified'}::${q.text}`;
        if (!seen.has(key) && q.text) {
          seen.add(key);
          next.push(q);
        }
      });
      return next;
    });
  };

  const runPipelineToQuestions = async (jobId: string) => {
    // SSE connection should already be active before the first task starts.

    // ── Stage 1: Audio extraction (already kicked off before this is called) ──
    setPipelineStep("AUDIO_EXTRACTION");
    addLog("Waiting for audio extraction…");
    await waitForSSEEvent(jobId, "AUDIO_EXTRACTION");
    addLog("Audio extraction complete ✓");

    // ── Stage 2: Transcript ──
    setPipelineStep("TRANSCRIPT_GENERATION");
    addLog("Starting transcript generation…");
    await aiSectionAPI.approveContinueTask(jobId);
    await aiSectionAPI.approveStartTask(jobId, { type: "TRANSCRIPT_GENERATION" });
    await waitForSSEEvent(jobId, "TRANSCRIPT_GENERATION");
    addLog("Transcript generation complete ✓");

    // ── Stage 3: Segmentation ──
    setPipelineStep("SEGMENTATION");
    addLog("Segmenting content…");
    await aiSectionAPI.approveContinueTask(jobId);
    await aiSectionAPI.approveStartTask(jobId, {
      type: "SEGMENTATION",
      parameters: { lam: 4.5, runs: 25, noiseId: -1, segmentationStrategy },
    });
    let segResult = await waitForSSEEvent(jobId, "SEGMENTATION");
    let numSegments: number | null = Array.isArray(segResult?.segmentationMap)
      ? (segResult.segmentationMap as number[]).length
      : null;
    if (numSegments) setSegmentCount(numSegments);
    addLog(`Segmentation complete ✓ — ${numSegments ?? "?"} segments found`);

    // Quiz-worthy check: ensure no segment is too short to support 15 questions
    const segMap = Array.isArray(segResult?.segmentationMap) ? (segResult.segmentationMap as number[]) : [];
    if (segMap.length > 1) {
      const durations = segMap.map((t, i) => (i === 0 ? t : t - segMap[i - 1]));
      const shortCount = durations.filter((d) => d < MIN_SEGMENT_DURATION_SECONDS).length;
      if (shortCount > 0) {
        addLog(`${shortCount} short segment(s) detected — re-segmenting for quiz-worthy coverage…`);
        await aiSectionAPI.rerunJobTask(jobId, "SEGMENTATION", {
          lam: 7.0,
          runs: 25,
          noiseId: -1,
          segmentationStrategy,
        });
        // Brief pause so the backend transitions the task status from COMPLETED → RUNNING
        await new Promise<void>((r) => setTimeout(r, 2000));
        segResult = await waitForSSEEvent(jobId, "SEGMENTATION", 12 * 60 * 1000, true);
        numSegments = Array.isArray(segResult?.segmentationMap)
          ? (segResult.segmentationMap as number[]).length
          : numSegments;
        if (numSegments) setSegmentCount(numSegments);
        addLog(`Re-segmentation complete ✓ — ${numSegments ?? "?"} segments found`);
      }
    }

    // ── Stage 4: Question generation ──
    setPipelineStep("QUESTION_GENERATION");
    addLog(`Generating questions for ${numSegments ?? "?"} segment(s)…`);
    await aiSectionAPI.approveContinueTask(jobId);
    await aiSectionAPI.approveStartTask(jobId, {
      type: "QUESTION_GENERATION",
      parameters: getQuestionGenerationParams(totalQuestions),
    });
    const qResult = await waitForSSEEvent(jobId, "QUESTION_GENERATION");
    addLog("Question generation complete ✓ — loading results…");
    disconnectSSE();

    // ── Progressive segment reveal ──
    // The fileUrl is delivered directly in the SSE COMPLETED event payload.
    const generated = await fetchLatestQuestionResults(jobId, qResult?.fileUrl as string | undefined);

    // Group by segment and reveal one segment at a time.
    const groups = new Map<number, CuratedQuestion[]>();
    for (const q of generated) {
      const bucket = groups.get(q.segmentId) ?? [];
      bucket.push(q);
      groups.set(q.segmentId, bucket);
    }
    const sortedSegIds = [...groups.keys()].sort((a, b) => a - b);

    setActiveSegmentIndex(0);
    setQuestionIndexBySegment({});
    setRevealedSegmentCount(0);

    for (let i = 0; i < sortedSegIds.length; i++) {
      if (i > 0) await new Promise<void>((r) => setTimeout(r, 450));
      const segId = sortedSegIds[i];
      const segQs = groups.get(segId)!;
      mergeQuestions(segQs);
      setRevealedSegmentCount(i + 1);
      addLog(`Segment ${i + 1} ready — ${segQs.length} questions available`);
      if (i === 0) {
        // Open curation immediately so the user can start swiping segment 1
        // while the remaining segments are still streaming in.
        setPipelineStep("CURATION_READY");
        toast.success(`Segment 1 ready — start swiping! More segments loading…`);
      }
    }

    if (sortedSegIds.length > 1) {
      toast.success(`All ${sortedSegIds.length} segments ready for curation.`);
    }
  };

  const requestRefillForSegment = async (segmentId: number) => {
    if (!createdJobId || isRefilling) return;

    // Count all non-rejected questions (not just ones not yet decided)
    const activeCount = questions.filter((q) => q.segmentId === segmentId && !rejectedQuestionIds.has(q.id)).length;
    if (activeCount >= MIN_ACTIVE_QUESTIONS_PER_SEGMENT) return;
    const needed = MIN_ACTIVE_QUESTIONS_PER_SEGMENT - activeCount;

    setIsRefilling(true);
    try {
      // Reconnect SSE so we can listen for the rerun completion event.
      connectSSE(createdJobId);
      // Backend may ignore targetSegmentId; still requests more questions and merges by segment.
      await aiSectionAPI.rerunJobTask(createdJobId, "QUESTION_GENERATION", {
        ...getQuestionGenerationParams(Math.max(needed, 3)),
        targetSegmentId: segmentId,
      });
      const qResult = await waitForSSEEvent(createdJobId, "QUESTION_GENERATION");
      disconnectSSE();
      const generated = await fetchLatestQuestionResults(createdJobId, qResult?.fileUrl as string | undefined);
      mergeQuestions(generated);
      toast.success(`Fetched additional questions for segment ${segmentId + 1}`);
    } catch (error) {
      console.error("Refill failed", error);
      disconnectSSE();
      toast.error("Could not auto-refill questions for this segment");
    } finally {
      setIsRefilling(false);
    }
  };

  const swipeQuestion = (direction: "left" | "right") => {
    if (!currentQuestion || isDecidedQ(currentQuestion.id)) return;

    const questionId = currentQuestion.id;
    const segmentId = currentSegmentId;
    const currentIndex = currentSegmentQuestionIndex;
    const allQs = currentAllSegmentQuestions;
    const acceptedSnap = acceptedQuestionIds;
    const rejectedSnap = rejectedQuestionIds;

    setSwipeDirection(direction);

    setTimeout(() => {
      const newAccepted = new Set(acceptedSnap);
      const newRejected = new Set(rejectedSnap);

      if (direction === "right") {
        newAccepted.add(questionId);
        setAcceptedQuestionIds(newAccepted);
      } else {
        newRejected.add(questionId);
        setRejectedQuestionIds(newRejected);
      }

      // Advance to next undecided question
      const nextIdx = allQs.findIndex(
        (q, idx) => idx > currentIndex && q.id !== questionId && !newAccepted.has(q.id) && !newRejected.has(q.id),
      );

      setSwipeDirection(null);

      if (nextIdx >= 0) {
        setIsNewQuestionEntering(true);
        setQuestionIndexBySegment((prev) => ({ ...prev, [segmentId]: nextIdx }));
        setTimeout(() => setIsNewQuestionEntering(false), 400);
      }

      if (direction === "left") {
        void requestRefillForSegment(segmentId);
      }
    }, 500);
  };

  const openEdit = (question: CuratedQuestion) => {
    const normalizedOptions = uniqueOptions(question.options.length > 0 ? question.options : [
      ...(question.raw?.solution?.correctLotItems || []).map((o: any) => o?.text),
      question.raw?.solution?.correctLotItem?.text,
      ...(question.raw?.solution?.incorrectLotItems || []).map((o: any) => o?.text),
    ]);

    const correctTexts = new Set(
      uniqueOptions([
        ...(question.raw?.solution?.correctLotItems || []).map((o: any) => o?.text),
        question.raw?.solution?.correctLotItem?.text,
      ]).map((v) => v.toLowerCase()),
    );

    const correctIndexes = normalizedOptions
      .map((opt, idx) => (correctTexts.has(opt.toLowerCase()) ? idx : -1))
      .filter((idx) => idx >= 0);

    setEditingQuestionId(question.id);
    setEditText(question.text);
    setEditOptions(normalizedOptions.length > 0 ? normalizedOptions : ["", ""]);
    setEditCorrectOptionIndexes(correctIndexes.length > 0 ? correctIndexes : [0]);
  };

  const saveEdit = () => {
    if (!editingQuestionId) return;

    const cleanedOptions = uniqueOptions(editOptions);
    if (cleanedOptions.length < 2) {
      toast.error("At least two unique options are required.");
      return;
    }

    const validCorrectIndexes = editCorrectOptionIndexes
      .filter((idx) => idx >= 0 && idx < cleanedOptions.length)
      .filter((idx, i, arr) => arr.indexOf(idx) === i);

    const correctIndexes = validCorrectIndexes.length > 0 ? validCorrectIndexes : [0];

    setQuestions((prev) =>
      prev.map((q) =>
        q.id !== editingQuestionId
          ? q
          : (() => {
              const correctTexts = correctIndexes.map((idx) => cleanedOptions[idx]);
              const incorrectTexts = cleanedOptions.filter((_, idx) => !correctIndexes.includes(idx));
              const isMulti =
                correctTexts.length > 1 ||
                q.raw?.question?.type === "MUL" ||
                q.raw?.questionType === "MUL";

              const nextSolution = {
                ...(q.raw?.solution || {}),
                correctLotItem: isMulti
                  ? undefined
                  : { text: correctTexts[0], explaination: q.raw?.solution?.correctLotItem?.explaination || "" },
                correctLotItems: isMulti
                  ? correctTexts.map((text) => ({ text, explaination: "" }))
                  : undefined,
                incorrectLotItems: incorrectTexts.map((text) => ({ text, explaination: "" })),
              };

              return {
                ...q,
                text: editText.trim(),
                options: cleanedOptions,
                raw: {
                  ...q.raw,
                  text: editText.trim(),
                  options: cleanedOptions,
                  segmentId: q.segmentId,
                  question: {
                    ...(q.raw?.question || {}),
                    type: q.raw?.question?.type ?? q.raw?.questionType ?? "SOL",
                    text: editText.trim(),
                  },
                  solution: nextSolution,
                },
              };
            })(),
      ),
    );
    setEditingQuestionId(null);
    toast.success("Question updated");
  };

  const uploadCuratedQuestions = async () => {
    if (!createdJobId || !currentCourse?.courseId || !currentCourse?.versionId || !currentCourse?.moduleId || !currentCourse?.sectionId) {
      toast.error("Missing job or course information");
      return;
    }

    const curated = questions
      .filter((q) => acceptedQuestionIds.has(q.id))
      .map((q) => ({
        ...q.raw,
        bloomLevel: q.bloomLevel ?? q.raw?.bloomLevel ?? q.raw?.question?.bloomLevel,
        segmentId: q.segmentId,
        question: {
          ...(q.raw?.question || {}),
          type: q.raw?.question?.type ?? q.raw?.questionType ?? "SOL",
          text: q.text,
          bloomLevel: q.bloomLevel ?? q.raw?.question?.bloomLevel ?? q.raw?.bloomLevel,
        },
        solution: q.raw?.solution,
        options: q.options,
      }));

    if (curated.length === 0) {
      toast.error("No accepted questions to upload");
      return;
    }

    const uploadParams = {
      courseId: currentCourse.courseId,
      versionId: currentCourse.versionId,
      moduleId: currentCourse.moduleId,
      sectionId: currentCourse.sectionId,
      smartBloomEnabled: true,
      videoItemBaseName: "video_item",
      quizItemBaseName: "quiz_item",
      questions: curated,
    };

    const refreshTeacherContentCache = async () => {
      // Force teacher UI to re-fetch latest generated items/quizzes after upload.
      await queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "get" &&
          query.queryKey[1] === "/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items",
      });

      await queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "get" &&
          query.queryKey[1] === "/courses/{id}/versions/{versionId}",
      });

      await queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "get" &&
          query.queryKey[1] === "/courses/{courseId}/versions/{versionId}/modules",
      });

      queryClient.removeQueries({
        predicate: (query) =>
          query.queryKey[0] === "get" &&
          query.queryKey[1] === "/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items",
      });
    };

    setIsUploading(true);
    setPipelineStep("UPLOAD_CONTENT");
    addLog("Starting content upload…");
    connectSSE(createdJobId);
    try {
      await aiSectionAPI.approveContinueTask(createdJobId);
      await aiSectionAPI.approveStartTask(createdJobId, {
        type: "UPLOAD_CONTENT",
        parameters: uploadParams,
      });
      await waitForSSEEvent(createdJobId, "UPLOAD_CONTENT");
      disconnectSSE();
      addLog("Upload complete ✓");
      await refreshTeacherContentCache();
      setPipelineStep("COMPLETED");
      toast.success("Curated questions uploaded successfully. Teacher content refreshed.");
      onUploadComplete?.(currentCourse.moduleId, currentCourse.sectionId);
    } catch (error: any) {
      const message = String(error?.message || "");
      const alreadyCompleted =
        message.includes("UPLOAD_CONTENT") && message.toLowerCase().includes("already completed");

      if (alreadyCompleted) {
        try {
          addLog("Upload task already completed once — rerunning with latest curated questions…");
          await aiSectionAPI.rerunJobTask(createdJobId, "UPLOAD_CONTENT", uploadParams);
          await waitForSSEEvent(createdJobId, "UPLOAD_CONTENT", 12 * 60 * 1000, true);
          disconnectSSE();
          addLog("Upload complete ✓ (rerun)");
          await refreshTeacherContentCache();
          setPipelineStep("COMPLETED");
          toast.success("Curated questions uploaded successfully. Teacher content refreshed.");
          onUploadComplete?.(currentCourse.moduleId, currentCourse.sectionId);
          return;
        } catch (rerunError) {
          console.error(rerunError);
          disconnectSSE();
          toast.error("Failed to rerun curated question upload");
          setPipelineStep("CURATION_READY");
          return;
        }
      }

      console.error(error);
      disconnectSSE();
      toast.error("Failed to upload curated questions");
      setPipelineStep("CURATION_READY");
    } finally {
      setIsUploading(false);
    }
  };

  const isValidYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})(\S*)?$/;
    return youtubeRegex.test(url.trim());
  };

  const handleStartSmartBloom = async () => {
    if (!currentCourse?.courseId || !currentCourse?.versionId) {
      toast.error("Missing course or version information");
      return;
    }

    if (!isValidYouTubeUrl(youtubeUrl)) {
      toast.error("Please enter a valid YouTube URL");
      return;
    }

    if (distributionSum !== 100) {
      toast.error("Bloom percentages must total 100");
      return;
    }

    setIsSubmitting(true);
    setStatusLog([]);
    setSegmentCount(null);
    setRevealedSegmentCount(0);
    setQuestions([]);
    setAcceptedQuestionIds(new Set());
    setRejectedQuestionIds(new Set());
    try {
      const questionGenerationParameters = {
        SOL: totalQuestions,
        SML: 0,
        NAT: 0,
        DES: 0,
        numberOfQuestions: totalQuestions,
        smartBloom: {
          enabled: true,
          segmentationStrategy,
          distribution,
        },
      };

      const { jobId } = await aiSectionAPI.createJob({
        videoUrl: youtubeUrl.trim(),
        courseId: currentCourse.courseId,
        versionId: currentCourse.versionId,
        moduleId: currentCourse.moduleId,
        sectionId: currentCourse.sectionId,
        videoItemBaseName: "video_item",
        quizItemBaseName: "quiz_item",
        questionGenerationParameters,
      });

      // Kick off pipeline from audio extraction for Smart Bloom flow.
      connectSSE(jobId);
      setPipelineStep("AUDIO_EXTRACTION");
      addLog("Requesting audio extraction start…");
      await aiSectionAPI.startAudioExtractionTask(jobId);
      addLog("Audio extraction start requested ✓");
      setCreatedJobId(jobId);
      toast.success("Smart Bloom job created. Running pipeline...");
      await runPipelineToQuestions(jobId);
    } catch (error) {
      console.error("Failed to start Smart Bloom job:", error);
      const msg = error instanceof Error ? error.message : "Unknown error";
      addLog(`Error: ${msg}`);
      toast.error(`Smart Bloom failed: ${msg}`);
      disconnectSSE();
      setPipelineStep("IDLE");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-xl">Smart Bloom&apos;s mode</CardTitle>
          <CardDescription>
            Configure Bloom distribution for one video and preview exact question counts before generation.
          </CardDescription>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Stage: {pipelineStep}</Badge>
            {createdJobId && <Badge variant="secondary">Job ID: {createdJobId}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="smart-bloom-youtube-url">YouTube URL</Label>
            <Input
              id="smart-bloom-youtube-url"
              placeholder="https://www.youtube.com/watch?v=..."
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="segmentation-strategy">Segmentation strategy</Label>
            <select
              id="segmentation-strategy"
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={segmentationStrategy}
              onChange={(e) => setSegmentationStrategy(e.target.value as "DEFAULT" | "CONCEPT_END")}
            >
              <option value="CONCEPT_END">Concept end (recommended)</option>
              <option value="DEFAULT">Default</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Concept end mode sends strategy as Smart Bloom metadata for segmentation-aware generation.
            </p>
          </div>

          <div className="rounded-lg border p-3 bg-muted/20">
            <p className="text-sm font-medium mb-2">Optional Bloom Levels (4-6)</p>
            <div className="flex flex-wrap gap-3 text-sm">
              {OPTIONAL_BLOOM_KEYS.map((key) => (
                <label key={key} className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={optionalBloomEnabled[key]}
                    onChange={() => toggleOptionalBloomLevel(key)}
                    className="h-4 w-4"
                  />
                  <span>{BLOOM_LEVEL_META[key].label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Levels 1-3 are always enabled. Levels 4-6 can be turned on when needed.</p>
          </div>

          <div className="rounded-lg border p-3 bg-muted/20">
            <p className="text-sm font-medium mb-2">Quick Presets</p>
            <div className="flex flex-wrap gap-2">
              {BLOOM_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => applyBloomPreset(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="total-questions">Total questions for this video</Label>
              <Input
                id="total-questions"
                type="number"
                min={1}
                value={totalQuestions}
                onChange={(e) => setTotalQuestions(clampToNumber(e.target.value, 1))}
              />
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant={distributionSum === 100 ? "default" : "destructive"}>
                  Total: {distributionSum}%
                </Badge>
                {distributionSum !== 100 && (
                  <Button variant="outline" size="sm" onClick={handleNormalize}>
                    Normalize to 100%
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activeBloomKeys.map((key) => (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    {key === "knowledge" ? <BookOpen className="h-4 w-4" /> : key === "understanding" ? <BrainCircuit className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />}
                    {BLOOM_LEVEL_META[key].label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Label htmlFor={key}>Percentage</Label>
                  <Input
                    id={key}
                    type="number"
                    min={0}
                    value={distribution[key]}
                    onChange={(e) => handleDistributionChange(key, e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{BLOOM_LEVEL_META[key].description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {distributionSum !== 100 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 flex items-start gap-2 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <p className="text-sm">
                Bloom percentages should total 100. Use Normalize to auto-balance while preserving relative weight.
              </p>
            </div>
          )}

          <div className="rounded-lg border p-4 bg-muted/20">
            <h3 className="text-sm font-semibold mb-3">Question allocation preview for this video</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              {activeBloomKeys.map((key) => (
                <div key={key} className="rounded-md border p-3">
                  <div className="text-muted-foreground">{BLOOM_LEVEL_META[key].label}</div>
                  <div className="text-xl font-semibold">{questionBreakdown[key]}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Allocation uses largest remainder so final counts always sum to total questions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleStartSmartBloom}
              disabled={isSubmitting || distributionSum !== 100 || pipelineStep !== "IDLE"}
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start Smart Bloom Generation
            </Button>
          </div>

          {/* ── Pipeline Progress Panel ── */}
          {pipelineStep !== "IDLE" && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Pipeline Progress</h3>
                {segmentCount && (
                  <Badge variant="outline">{segmentCount} segments detected</Badge>
                )}
              </div>

              {/* Step strip */}
              <div className="flex items-center gap-1 flex-wrap">
                {([
                  { key: "AUDIO_EXTRACTION", label: "Audio" },
                  { key: "TRANSCRIPT_GENERATION", label: "Transcript" },
                  { key: "SEGMENTATION", label: "Segmentation" },
                  { key: "QUESTION_GENERATION", label: "Questions" },
                ] as const).map((step, idx) => {
                  const order: PipelineStep[] = [
                    "AUDIO_EXTRACTION",
                    "TRANSCRIPT_GENERATION",
                    "SEGMENTATION",
                    "QUESTION_GENERATION",
                    "CURATION_READY",
                    "UPLOAD_CONTENT",
                    "COMPLETED",
                  ];
                  const current = order.indexOf(pipelineStep);
                  const pos = idx;
                  const isDone = current > pos;
                  const isActive = current === pos;
                  return (
                    <span key={step.key} className="flex items-center gap-1">
                      {idx > 0 && <span className="text-muted-foreground">›</span>}
                      <span
                        className={cn(
                          "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border",
                          isDone && "bg-green-50 border-green-200 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400",
                          isActive && "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400",
                          !isDone && !isActive && "text-muted-foreground",
                        )}
                      >
                        {isDone ? (
                          <Check className="h-3 w-3" />
                        ) : isActive ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <span className="h-3 w-3 rounded-full border inline-block" />
                        )}
                        {step.label}
                      </span>
                    </span>
                  );
                })}
              </div>

              {/* Segment-level question progress (during/after QUESTION_GENERATION) */}
              {(pipelineStep === "QUESTION_GENERATION" || pipelineStep === "CURATION_READY") && segmentCount && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {pipelineStep === "CURATION_READY"
                        ? `${revealedSegmentCount} of ${segmentCount} segments ready to curate`
                        : `Generating questions…`}
                    </span>
                    <span>{revealedSegmentCount}/{segmentCount}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${(revealedSegmentCount / segmentCount) * 100}%` }}
                    />
                  </div>
                  {pipelineStep === "CURATION_READY" && revealedSegmentCount < segmentCount && (
                    <p className="text-xs text-muted-foreground animate-pulse">Loading remaining segments…</p>
                  )}
                </div>
              )}

              {/* Status log */}
              {statusLog.length > 0 && (
                <div className="rounded border bg-background p-2 space-y-0.5 max-h-28 overflow-y-auto">
                  {statusLog.slice(-10).map((msg, i) => (
                    <p key={i} className="text-[11px] font-mono text-muted-foreground leading-snug">{msg}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {pipelineStep === "CURATION_READY" && (
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Question Curation</h3>
                <Badge variant="outline">Accepted: {acceptedCount}</Badge>
              </div>

              {/* Segment loading notice */}
              {segmentCount && revealedSegmentCount < segmentCount && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-md border border-dashed p-2">
                  <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                  Loading segment {revealedSegmentCount + 1} of {segmentCount}…
                </div>
              )}

              {segmentIds.length > 0 && (
                <div className="relative">
                  {/* Segment navigation */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setActiveSegmentIndex((prev) => Math.max(0, prev - 1))}
                        disabled={activeSegmentIndex === 0}
                        className="h-8 w-8 p-0 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="text-sm font-semibold px-4 py-2 bg-primary/10 border border-primary/30 rounded-lg dark:text-primary text-black">
                        Segment {activeSegmentIndex + 1} of {segmentIds.length}
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setActiveSegmentIndex((prev) => Math.min(segmentIds.length - 1, prev + 1))}
                        disabled={activeSegmentIndex >= segmentIds.length - 1}
                        className="h-8 w-8 p-0 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {currentSegmentAcceptedCount} accepted · {currentAllSegmentQuestions.length} total
                    </div>
                  </div>

                  {/* Question card */}
                  {currentQuestion ? (
                    <div className="relative px-6">
                      {/* Reject button */}
                      <button
                        onClick={() => swipeQuestion("left")}
                        disabled={isDecidedQ(currentQuestion.id) || !!swipeDirection}
                        className={cn(
                          "absolute top-[90px] -left-1 z-10 p-2 rounded-full transition-colors border",
                          "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
                          isDecidedQ(currentQuestion.id) || swipeDirection
                            ? "opacity-30 cursor-not-allowed"
                            : "hover:bg-red-100 dark:hover:bg-red-900/30 cursor-pointer text-red-500",
                        )}
                        aria-label="Reject question"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      {/* Card */}
                      <div
                        className={cn(
                          "bg-card/90 border rounded-lg p-4 transition-all duration-500 ease-in-out transform relative",
                          swipeDirection === "right"
                            ? "translate-x-full opacity-0"
                            : swipeDirection === "left"
                            ? "-translate-x-full opacity-0"
                            : isNewQuestionEntering
                            ? "opacity-0 scale-95"
                            : "translate-x-0 opacity-100 scale-100",
                          isAcceptedQ(currentQuestion.id)
                            ? "border-green-500 dark:border-green-700 bg-green-50/50 dark:bg-green-900/20"
                            : isRejectedQ(currentQuestion.id)
                            ? "border-red-500 dark:border-red-700 bg-red-50/50 dark:bg-red-900/20 opacity-70"
                            : "border-gray-200 dark:border-gray-600 hover:shadow-md",
                        )}
                      >
                        {isAcceptedQ(currentQuestion.id) && (
                          <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Accepted
                          </div>
                        )}
                        {isRejectedQ(currentQuestion.id) && (
                          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Rejected
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-medium">
                              Segment {activeSegmentIndex + 1}
                            </span>
                            {(currentQuestion.raw?.questionType || currentQuestion.raw?.question?.type) && (
                              <span className="bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full font-medium">
                                {currentQuestion.raw?.questionType ?? currentQuestion.raw?.question?.type}
                              </span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-800 dark:text-white transition-colors bg-transparent"
                            onClick={() => openEdit(currentQuestion)}
                          >
                            <Pencil className="w-4 h-4 mr-1" /> Edit
                          </Button>
                        </div>

                        {/* Question text */}
                        <div className="mb-3">
                          <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-relaxed">
                            Q{currentSegmentQuestionIndex + 1}: {currentQuestion.text}
                          </h4>
                        </div>

                        {/* Answer options */}
                        {currentQuestion.raw?.solution ? (
                          <div className="space-y-2">
                            <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Answer Options:</h5>
                            <div className="space-y-1">
                              {currentQuestion.raw.solution.incorrectLotItems?.map((opt: any, oIdx: number) => (
                                <div
                                  key={`inc-${oIdx}`}
                                  className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm"
                                >
                                  <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center shrink-0">
                                    <span className="text-white text-xs">✕</span>
                                  </div>
                                  <span className="text-red-700 dark:text-red-300">{opt.text}</span>
                                </div>
                              ))}
                              {currentQuestion.raw.solution.correctLotItems?.map((opt: any, oIdx: number) => (
                                <div
                                  key={`cor-${oIdx}`}
                                  className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm"
                                >
                                  <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                                    <span className="text-white text-xs">✓</span>
                                  </div>
                                  <span className="text-green-700 dark:text-green-300 font-medium">{opt.text}</span>
                                </div>
                              ))}
                              {currentQuestion.raw.solution.correctLotItem && (
                                <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm">
                                  <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                                    <span className="text-white text-xs">✓</span>
                                  </div>
                                  <span className="text-green-700 dark:text-green-300 font-medium">
                                    {currentQuestion.raw.solution.correctLotItem.text}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : currentQuestion.options.length > 0 ? (
                          <ul className="space-y-1">
                            {currentQuestion.options.map((opt, idx) => (
                              <li
                                key={`opt-${idx}`}
                                className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-sm"
                              >
                                <span className="text-gray-600 dark:text-gray-300">{opt}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>

                      {/* Accept button */}
                      <button
                        onClick={() => swipeQuestion("right")}
                        disabled={isDecidedQ(currentQuestion.id) || !!swipeDirection}
                        className={cn(
                          "absolute top-[90px] -right-1 z-10 p-2 rounded-full transition-colors border",
                          "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
                          isDecidedQ(currentQuestion.id) || swipeDirection
                            ? "opacity-30 cursor-not-allowed"
                            : "hover:bg-green-100 dark:hover:bg-green-900/30 cursor-pointer text-green-500",
                        )}
                        aria-label="Accept question"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      All questions in this segment have been reviewed.
                    </div>
                  )}

                  {/* Question navigator within segment */}
                  {currentAllSegmentQuestions.length > 1 && (
                    <div className="mt-4 flex items-center justify-center gap-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setQuestionIndexBySegment((prev) => ({
                            ...prev,
                            [currentSegmentId]: Math.max(0, (prev[currentSegmentId] ?? 0) - 1),
                          }))
                        }
                        disabled={currentSegmentQuestionIndex === 0 || !!swipeDirection}
                      >
                        ← Prev
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {currentSegmentQuestionIndex + 1} / {currentAllSegmentQuestions.length}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setQuestionIndexBySegment((prev) => ({
                            ...prev,
                            [currentSegmentId]: Math.min(
                              currentAllSegmentQuestions.length - 1,
                              (prev[currentSegmentId] ?? 0) + 1,
                            ),
                          }))
                        }
                        disabled={currentSegmentQuestionIndex >= currentAllSegmentQuestions.length - 1 || !!swipeDirection}
                      >
                        Next →
                      </Button>
                    </div>
                  )}

                  {isRefilling && (
                    <p className="text-sm text-center text-muted-foreground animate-pulse mt-2">Fetching more questions…</p>
                  )}

                  {/* Per-segment progress */}
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Segment Progress</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {currentSegmentAcceptedCount} accepted · Segment {activeSegmentIndex + 1} of {segmentIds.length}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                      <div
                        className="bg-green-600 h-2.5 rounded-full transition-all duration-300"
                        style={{
                          width: `${(currentSegmentAcceptedCount / Math.max(1, currentAllSegmentQuestions.length - currentSegmentRejectedCount)) * 100}%`,
                          minWidth: currentSegmentAcceptedCount > 0 ? "0.5rem" : "0",
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Accept at least one question per segment to upload.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end mt-4">
                <Button
                  onClick={uploadCuratedQuestions}
                  disabled={isUploading || !canProceed}
                  title={!canProceed ? "Accept at least one question per segment to upload" : undefined}
                  className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-primary-foreground font-semibold px-8 py-5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center gap-2"
                >
                  {isUploading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
                  ) : (
                    <>Upload Curated Questions <ArrowRight className="w-4 h-4" /></>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingQuestionId)} onOpenChange={(open) => !open && setEditingQuestionId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
            <DialogDescription>
              Update the question text, adjust options, and mark the correct answer(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="edit-question-text">Question</Label>
            <Textarea
              id="edit-question-text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />
            <Label>Options</Label>
            {editOptions.map((opt, idx) => (
              <div key={`edit-opt-${idx}`} className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={editCorrectOptionIndexes.includes(idx) ? "default" : "outline"}
                  onClick={() => {
                    setEditCorrectOptionIndexes((prev) =>
                      prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx],
                    );
                  }}
                >
                  {editCorrectOptionIndexes.includes(idx) ? "Correct" : "Mark"}
                </Button>
                <Input
                  value={opt}
                  onChange={(e) =>
                    setEditOptions((prev) => prev.map((item, i) => (i === idx ? e.target.value : item)))
                  }
                  placeholder={`Option ${idx + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setEditOptions((prev) => prev.filter((_, i) => i !== idx));
                    setEditCorrectOptionIndexes((prev) =>
                      prev
                        .filter((i) => i !== idx)
                        .map((i) => (i > idx ? i - 1 : i)),
                    );
                  }}
                  disabled={editOptions.length <= 2}
                  title={editOptions.length <= 2 ? "At least 2 options are required" : "Delete option"}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Mark one or more correct options. Duplicate options are removed on save.</p>
            <Button
              variant="outline"
              onClick={() => setEditOptions((prev) => [...prev, ""])}
            >
              Add option
            </Button>
            <div className="flex items-center gap-2">
              <Button onClick={saveEdit}>Save</Button>
              <Button variant="ghost" onClick={() => setEditingQuestionId(null)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SmartBloomWorkflow;
