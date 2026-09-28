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
import { DirectApiError, smartBloomDirectAPI, textInWindow, type TranscriptChunk } from "@/lib/smart-bloom-direct-api";
import { readTranscriptFile } from "@/lib/transcript-file-reader";
import {
  BROWSER_WHISPER_MODELS,
  DEFAULT_BROWSER_WHISPER_MODEL,
  transcribeMediaFile,
  type TranscriptionProgress,
} from "@/lib/browser-transcriber";
import { Progress } from "@/components/ui/progress";
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
type QuestionTypeKey = "SOL" | "SML" | "NAT" | "DES" | "BIN";

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

const QUESTION_TYPE_META: Record<QuestionTypeKey, { label: string; description: string }> = {
  SOL: { label: "Single Correct (MCQ)", description: "One correct option" },
  SML: { label: "Multiple Correct", description: "More than one correct option" },
  NAT: { label: "Numeric", description: "Answer is a number/value" },
  DES: { label: "Descriptive", description: "Short explanation-based answer" },
  BIN: { label: "Binary", description: "Yes/No or True/False" },
};

const ALL_QUESTION_TYPES: QuestionTypeKey[] = ["SOL", "SML", "NAT", "DES", "BIN"];

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

type TranscriptInput =
  | { kind: "file"; file: File }
  | { kind: "text"; text: string }
  // A video or audio file, transcribed in the browser with Whisper.
  | { kind: "media"; file: File; model: string };

/** Seconds as m:ss or h:mm:ss, for log lines. */
const formatClock = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

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
const MIN_BLOOM_QUESTIONS_PER_SEGMENT = 3;
const MAX_BLOOM_QUESTIONS_PER_SEGMENT = 10;
const DEFAULT_BLOOM_QUESTIONS_PER_SEGMENT = 5;

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

const BINARY_POSITIVE_TOKENS = new Set(["yes", "true", "y", "t"]);
const BINARY_NEGATIVE_TOKENS = new Set(["no", "false", "n", "f"]);

const normalizeBinaryToken = (value: string): string =>
  normalizeOptionText(value)
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim();

const getBinaryPolarity = (value: string): "positive" | "negative" | null => {
  const token = normalizeBinaryToken(value);
  if (BINARY_POSITIVE_TOKENS.has(token)) return "positive";
  if (BINARY_NEGATIVE_TOKENS.has(token)) return "negative";
  return null;
};

const isBinaryQuestionText = (questionText: string): boolean => {
  const text = String(questionText ?? "").trim().toLowerCase();
  if (!text) return false;
  if (/^true\s*\/\s*false\b/.test(text)) return true;
  if (/^true\s+or\s+false\b/.test(text)) return true;
  if (/^(is|are|am|was|were|do|does|did|can|could|should|will|would|has|have|had)\b/.test(text)) return true;
  return false;
};

const enforceBinaryOptionLimit = (questionText: string, options: string[]): string[] => {
  const cleaned = uniqueOptions(options);
  const entries = cleaned.map((opt) => ({ opt, polarity: getBinaryPolarity(opt) }));
  const hasPositive = entries.some((entry) => entry.polarity === "positive");
  const hasNegative = entries.some((entry) => entry.polarity === "negative");
  const binaryByOptions = hasPositive && hasNegative;
  const binaryByQuestion = isBinaryQuestionText(questionText);

  if (!binaryByOptions && !binaryByQuestion) {
    return cleaned;
  }

  const positive = entries.find((entry) => entry.polarity === "positive")?.opt ?? "Yes";
  const negative = entries.find((entry) => entry.polarity === "negative")?.opt ?? "No";
  return uniqueOptions([positive, negative]).slice(0, 2);
};

const BLOOM_LEVEL_BADGE_CLASSES: Record<BloomKey | "unclassified", string> = {
  knowledge: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300",
  understanding: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  application: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  analysis: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  evaluation: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  creation: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300",
  unclassified: "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
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

const allocateQuestionTypes = (
  totalQuestions: number,
  enabledTypes: QuestionTypeKey[],
): Record<QuestionTypeKey, number> => {
  const allocations: Record<QuestionTypeKey, number> = {
    SOL: 0,
    SML: 0,
    NAT: 0,
    DES: 0,
    BIN: 0,
  };

  if (enabledTypes.length === 0 || totalQuestions <= 0) {
    return allocations;
  }

  const base = Math.floor(totalQuestions / enabledTypes.length);
  let remainder = totalQuestions - base * enabledTypes.length;

  enabledTypes.forEach((type) => {
    allocations[type] = base;
  });

  enabledTypes.forEach((type) => {
    if (remainder <= 0) return;
    allocations[type] += 1;
    remainder -= 1;
  });

  return allocations;
};

type SmartBloomGenerationPlan = {
  totalQuestions: number;
  perSegmentBloomTargets: number[];
  totalPerBloomLevel: number;
  segmentInstructionBlock: string;
};

type QuestionNormalizationContext = {
  segmentMap?: number[];
  perSegmentQuestionTargets?: number[];
};

const buildSmartBloomGenerationPlan = (
  segmentationMap: number[],
  activeKeys: BloomKey[],
): SmartBloomGenerationPlan => {
  const durations = segmentationMap.length > 0
    ? segmentationMap.map((end, index) => (index === 0 ? end : end - segmentationMap[index - 1]))
    : [MIN_SEGMENT_DURATION_SECONDS];

  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);

  const perSegmentBloomTargets = durations.map((duration) => {
    if (maxDuration === minDuration) {
      return DEFAULT_BLOOM_QUESTIONS_PER_SEGMENT;
    }

    const normalized = (duration - minDuration) / (maxDuration - minDuration);
    return MIN_BLOOM_QUESTIONS_PER_SEGMENT + Math.round(normalized * (MAX_BLOOM_QUESTIONS_PER_SEGMENT - MIN_BLOOM_QUESTIONS_PER_SEGMENT));
  });

  const totalPerBloomLevel = perSegmentBloomTargets.reduce((sum, count) => sum + count, 0);
  const totalQuestions = totalPerBloomLevel * activeKeys.length;
  const segmentInstructionBlock = perSegmentBloomTargets
    .map((count, index) => {
      const durationMinutes = (durations[index] / 60).toFixed(1);
      return `- Segment ${index + 1} (~${durationMinutes} min): generate ${count} question(s) for each enabled Bloom level.`;
    })
    .join("\n");

  return {
    totalQuestions,
    perSegmentBloomTargets,
    totalPerBloomLevel,
    segmentInstructionBlock,
  };
};

const normalizeSegmentMap = (value: unknown): number[] =>
  Array.isArray(value)
    ? value
        .map((entry) => Number(entry))
        .filter((entry) => Number.isFinite(entry) && entry > 0)
    : [];

const parseSegmentNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = String(value ?? "").trim();
  if (!text) return null;

  const direct = Number(text);
  if (Number.isFinite(direct)) {
    return direct;
  }

  const matched = text.match(/(\d+(?:\.\d+)?)/);
  if (!matched) return null;

  const parsed = Number(matched[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const scaleSegmentTargets = (
  totalQuestions: number,
  requestedTargets: number[],
): number[] => {
  if (totalQuestions <= 0 || requestedTargets.length === 0) {
    return requestedTargets.map(() => 0);
  }

  const sanitizedTargets = requestedTargets.map((target) => Math.max(0, Math.floor(target)));
  const totalRequested = sanitizedTargets.reduce((sum, target) => sum + target, 0);

  if (totalRequested <= 0) {
    const evenShare = Math.floor(totalQuestions / requestedTargets.length);
    let remainder = totalQuestions - evenShare * requestedTargets.length;
    return requestedTargets.map(() => {
      const allocation = evenShare + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      return allocation;
    });
  }

  const weighted = sanitizedTargets.map((target, index) => {
    const exact = (target / totalRequested) * totalQuestions;
    return {
      index,
      allocation: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });

  let allocated = weighted.reduce((sum, entry) => sum + entry.allocation, 0);
  let remaining = totalQuestions - allocated;

  weighted
    .slice()
    .sort((left, right) => right.remainder - left.remainder)
    .forEach((entry) => {
      if (remaining <= 0) return;
      weighted[entry.index].allocation += 1;
      remaining -= 1;
    });

  if (totalQuestions >= requestedTargets.length) {
    for (let index = 0; index < weighted.length; index += 1) {
      if (remaining <= 0) break;
      if (weighted[index].allocation > 0) continue;
      weighted[index].allocation = 1;
      remaining -= 1;
    }
  }

  while (remaining > 0) {
    for (let index = 0; index < weighted.length && remaining > 0; index += 1) {
      weighted[index].allocation += 1;
      remaining -= 1;
    }
  }

  allocated = weighted.reduce((sum, entry) => sum + entry.allocation, 0);
  if (allocated > totalQuestions) {
    let overflow = allocated - totalQuestions;
    for (let index = weighted.length - 1; index >= 0 && overflow > 0; index -= 1) {
      const removable = Math.min(weighted[index].allocation, overflow);
      weighted[index].allocation -= removable;
      overflow -= removable;
    }
  }

  return weighted.map((entry) => entry.allocation);
};

const rebalanceQuestionsAcrossSegments = (
  questions: CuratedQuestion[],
  segmentMap: number[],
  requestedTargets: number[],
): CuratedQuestion[] => {
  if (!questions.length || !segmentMap.length) {
    return questions;
  }

  const scaledTargets = scaleSegmentTargets(
    questions.length,
    requestedTargets.length === segmentMap.length
      ? requestedTargets
      : segmentMap.map(() => 1),
  );

  let runningTotal = 0;
  let currentSegmentIndex = 0;

  return questions.map((question, idx) => {
    while (
      currentSegmentIndex < scaledTargets.length - 1 &&
      idx >= runningTotal + scaledTargets[currentSegmentIndex]
    ) {
      runningTotal += scaledTargets[currentSegmentIndex];
      currentSegmentIndex += 1;
    }

    const reassignedSegmentId = segmentMap[currentSegmentIndex] ?? segmentMap[0];
    return {
      ...question,
      segmentId: reassignedSegmentId,
      id: `${reassignedSegmentId}-${(question.text || "q").slice(0, 32)}-${idx}`,
    };
  });
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
  const [questionTypeEnabled, setQuestionTypeEnabled] = useState<Record<QuestionTypeKey, boolean>>({
    SOL: true,
    SML: false,
    NAT: false,
    DES: false,
    BIN: false,
  });
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

  // Direct path (no AI server): the instructor's transcript + MiniMax.
  // The page holds the transcript and segment map because the backend keeps no state.
  const [pipelineMode, setPipelineMode] = useState<"AI_SERVER" | "DIRECT">("AI_SERVER");
  const directTranscriptRef = useRef<TranscriptChunk[]>([]);
  const directSegmentMapRef = useRef<number[]>([]);
  const directQuestionSeqRef = useRef(0);
  const [transcriptPrompt, setTranscriptPrompt] = useState<string | null>(null);
  // Why the last run stopped; stays on screen (with the log) until the next run starts.
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [isReadingTranscriptFile, setIsReadingTranscriptFile] = useState(false);
  const [pastedTranscript, setPastedTranscript] = useState("");
  const transcriptFileResolverRef = useRef<((input: TranscriptInput | null) => void) | null>(null);
  // In-browser transcription of an uploaded video/audio file (direct mode).
  const [whisperModel, setWhisperModel] = useState(DEFAULT_BROWSER_WHISPER_MODEL);
  const [mediaProgress, setMediaProgress] = useState<TranscriptionProgress | null>(null);
  const mediaAbortRef = useRef<AbortController | null>(null);
  // Set once the AI-server run reaches curation; after that an error is not an outage.
  const aiCurationStartedRef = useRef(false);

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
      // Stop an in-browser transcription; its worker would otherwise keep running.
      mediaAbortRef.current?.abort();
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

  const activeQuestionTypes = useMemo(
    () => ALL_QUESTION_TYPES.filter((type) => questionTypeEnabled[type]),
    [questionTypeEnabled],
  );

  const questionTypeBreakdown = useMemo(
    () => allocateQuestionTypes(totalQuestions, activeQuestionTypes),
    [totalQuestions, activeQuestionTypes],
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

  const toggleQuestionType = (type: QuestionTypeKey) => {
    setQuestionTypeEnabled((prev) => {
      const next = { ...prev, [type]: !prev[type] };
      const selectedCount = ALL_QUESTION_TYPES.filter((k) => next[k]).length;
      if (selectedCount === 0) {
        toast.error("Select at least one question type.");
        return prev;
      }
      return next;
    });
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

  const normalizeQuestionPayload = (
    data: any,
    context: QuestionNormalizationContext = {},
  ): CuratedQuestion[] => {
    const segmentMap = normalizeSegmentMap(context.segmentMap);

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

    const resolveSegmentId = (item: any, fallbackSegment: number) => {
      const explicitSegment =
        item?.segmentId ??
        item?.segment ??
        item?.segmentIndex ??
        item?.segmentNumber ??
        item?.segment_id ??
        item?.question?.segmentId ??
        item?.question?.segment ??
        item?.question?.segmentIndex ??
        item?.question?.segmentNumber ??
        item?.metadata?.segmentId ??
        item?.metadata?.segmentIndex ??
        item?.metadata?.segmentNumber;

      const parsedSegment = parseSegmentNumber(explicitSegment);
      if (parsedSegment == null) {
        return fallbackSegment;
      }

      if (!segmentMap.length) {
        return parsedSegment;
      }

      if (segmentMap.includes(parsedSegment)) {
        return parsedSegment;
      }

      const zeroBasedIndex = Math.trunc(parsedSegment);
      if (zeroBasedIndex >= 0 && zeroBasedIndex < segmentMap.length) {
        return segmentMap[zeroBasedIndex];
      }

      const oneBasedIndex = Math.trunc(parsedSegment) - 1;
      if (oneBasedIndex >= 0 && oneBasedIndex < segmentMap.length) {
        return segmentMap[oneBasedIndex];
      }

      return parsedSegment;
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
      const normalizedOptions = enforceBinaryOptionLimit(questionText, baseOptions.filter(Boolean));
      const segmentId = resolveSegmentId(item, fallbackSegment);
      const stableId = `${segmentId}-${(questionText || "q").slice(0, 32)}-${indexSeed}`;
      return {
        id: stableId,
        segmentId: Number.isFinite(segmentId) ? segmentId : fallbackSegment,
        bloomLevel: normalizeBloomLevel(item?.bloomLevel ?? item?.question?.bloomLevel),
        text: questionText,
        options: normalizedOptions,
        raw: item,
      };
    };

    if (Array.isArray(data)) {
      const flatData = data.filter((entry) => entry && typeof entry === "object");
      const hasExplicitSegments = flatData.some((entry) =>
        parseSegmentNumber(
          entry?.segmentId ?? entry?.segment ?? entry?.segmentIndex ?? entry?.segmentNumber,
        ) != null,
      );

      const perSegmentQuestionTargets = Array.isArray(context.perSegmentQuestionTargets)
        ? context.perSegmentQuestionTargets
        : [];

      if (!hasExplicitSegments && segmentMap.length > 1) {
        const normalized = flatData.map((question, idx) =>
          buildQuestion(question, segmentMap[0] ?? 0, idx),
        );
        return rebalanceQuestionsAcrossSegments(normalized, segmentMap, perSegmentQuestionTargets);
      }

      const normalized = flatData.map((q, idx) => buildQuestion(q, segmentMap[0] ?? 0, idx));

      if (segmentMap.length > 1) {
        const uniqueSegmentCount = new Set(normalized.map((q) => q.segmentId)).size;
        const shouldRebalanceCollapsedOutput =
          uniqueSegmentCount <= 1 &&
          normalized.length >= segmentMap.length;

        if (shouldRebalanceCollapsedOutput) {
          return rebalanceQuestionsAcrossSegments(normalized, segmentMap, perSegmentQuestionTargets);
        }
      }

      return normalized;
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
          const fallbackSegment = resolveSegmentId(segment, segmentMap[segIdx] ?? segIdx);
          flat.push(buildQuestion(q, fallbackSegment, segIdx * 1000 + qIdx));
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

  const fetchLatestTaskRun = async <T,>(jobId: string, taskKey: string): Promise<T | null> => {
    const token = localStorage.getItem("firebase-auth-token");
    if (!token) throw new Error("Authentication token missing");

    const statusUrl = getApiUrl(`/genai/${jobId}/tasks/${taskKey}/status`);
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!statusRes.ok) {
      throw new Error(`Failed to fetch ${taskKey} status`);
    }

    const payload = await statusRes.json();
    if (Array.isArray(payload)) {
      return (payload[payload.length - 1] ?? null) as T | null;
    }

    return (payload ?? null) as T | null;
  };

  const fetchLatestSegmentationMap = async (jobId: string): Promise<number[]> => {
    const latestSegmentation = await fetchLatestTaskRun<{ segmentationMap?: unknown }>(jobId, "SEGMENTATION");
    return normalizeSegmentMap(latestSegmentation?.segmentationMap);
  };

  const extractTranscriptEndTime = (transcriptPayload: any): number => {
    const chunks = Array.isArray(transcriptPayload?.chunks) ? transcriptPayload.chunks : [];
    if (!chunks.length) return 0;

    let maxEnd = 0;
    chunks.forEach((chunk: any) => {
      const rawEnd = chunk?.timestamp?.[1];
      const parsedEnd = Number(rawEnd);
      if (Number.isFinite(parsedEnd) && parsedEnd > maxEnd) {
        maxEnd = parsedEnd;
      }
    });

    return maxEnd;
  };

  const updateSegmentationMapForJob = async (jobId: string, segmentMap: number[]) => {
    const token = localStorage.getItem("firebase-auth-token");
    if (!token) throw new Error("Authentication token missing");

    const url = getApiUrl(`/genai/jobs/${jobId}/edit/segment-map`);
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ segmentMap }),
    });

    if (!response.ok) {
      throw new Error("Failed to update segmentation map");
    }
  };

  const ensureSegmentationCoversTranscriptEnd = async (jobId: string, segmentMap: number[]): Promise<number[]> => {
    const latestSegmentation = await fetchLatestTaskRun<{
      transcriptFileUrl?: string;
      segmentationMap?: unknown;
    }>(jobId, "SEGMENTATION");

    const normalizedMap = segmentMap.length > 0
      ? segmentMap
      : normalizeSegmentMap(latestSegmentation?.segmentationMap);

    const transcriptFileUrl = latestSegmentation?.transcriptFileUrl;
    if (!transcriptFileUrl) {
      return normalizedMap;
    }

    const transcriptRes = await fetch(transcriptFileUrl);
    if (!transcriptRes.ok) {
      return normalizedMap;
    }

    const transcriptPayload = await transcriptRes.json();
    const transcriptEndTime = extractTranscriptEndTime(transcriptPayload);
    if (!Number.isFinite(transcriptEndTime) || transcriptEndTime <= 0) {
      return normalizedMap;
    }

    const sortedMap = [...normalizedMap].sort((a, b) => a - b);
    const lastBoundary = sortedMap[sortedMap.length - 1] ?? 0;
    const COVERAGE_TOLERANCE_SECONDS = 1;

    if (lastBoundary >= transcriptEndTime - COVERAGE_TOLERANCE_SECONDS) {
      return sortedMap;
    }

    const correctedEnd = Number(transcriptEndTime.toFixed(2));
    const correctedMap = [...sortedMap, correctedEnd];
    await updateSegmentationMapForJob(jobId, correctedMap);
    return correctedMap;
  };

  const fetchLatestQuestionResults = async (
    jobId: string,
    directFileUrl?: string,
    context: QuestionNormalizationContext = {},
  ): Promise<CuratedQuestion[]> => {
    let fileUrl = directFileUrl;

    if (!fileUrl) {
      const latest = await fetchLatestTaskRun<{ fileUrl?: string }>(jobId, "QUESTION_GENERATION");
      if (!latest?.fileUrl) throw new Error("Question file URL not found");
      fileUrl = latest.fileUrl;
    }

    const fileRes = await fetch(fileUrl!);
    if (!fileRes.ok) throw new Error("Failed to fetch question file");
    const fileJson = await fileRes.json();
    return normalizeQuestionPayload(fileJson, context);
  };

  const getQuestionGenerationParams = (
    numQuestions: number,
    segmentInstructionBlock?: string,
  ) => ({
    ...allocateQuestionTypes(numQuestions, activeQuestionTypes),
    numberOfQuestions: numQuestions,
    prompt:
      "SCENARIO-BASED QUESTIONS ONLY.\n" +
      "Every single question — regardless of Bloom level — MUST open with a brief realistic mini-scenario or situational context drawn from the segment content. The cognitive question must be asked within that scenario. Pure recall or definition questions that present no scenario are STRICTLY FORBIDDEN.\n" +
      "Scenarios MUST show variety in domain and application. Do not repeat one profession, one setting, or one type of problem across all questions.\n" +
      "Use diverse real-world contexts such as education, healthcare, public services, business operations, logistics, manufacturing, environment, community life, and everyday decision-making whenever relevant to the transcript.\n" +
      "Do not default to software/developer contexts unless the segment explicitly focuses on software development.\n" +
      "\n" +
      "Example of a FORBIDDEN (non-scenario) question:\n" +
      "  'What is the definition of X?' — NOT acceptable.\n" +
      "Example of REQUIRED scenario variety:\n" +
      "  'A nurse in a clinic must decide which symptom trend needs immediate escalation. Which interpretation is most accurate?'\n" +
      "  'A school coordinator notices attendance dropping after a schedule change. Which cause is best supported by the data?'\n" +
      "  'A warehouse supervisor must reduce delayed dispatches under limited staffing. Which first action is most effective?'\n" +
      "\n" +
      "GENERATE STRICTLY BY BLOOM'S TAXONOMY LEVEL.\n" +
      "\n" +
      `Enabled Bloom levels: ${activeBloomKeys.map((key) => BLOOM_LEVEL_META[key].label).join(", ")}.\n` +
      `For every segment, generate between ${MIN_BLOOM_QUESTIONS_PER_SEGMENT} and ${MAX_BLOOM_QUESTIONS_PER_SEGMENT} questions for each enabled Bloom level based on transcript depth, conceptual density, and segment duration.\n` +
      "Use this segment-by-segment plan:\n" +
      `${segmentInstructionBlock ?? "- For each segment, generate 3 to 10 questions for every enabled Bloom level depending on transcript richness."}\n` +
      "Return questions in segment order. Every question MUST include the segment it belongs to using either segmentNumber (1-based) or segmentIndex (0-based).\n" +
      "Across each segment, include multiple application styles: diagnosing an issue, choosing between options, prioritizing actions, evaluating trade-offs, and designing improvements.\n" +
      "\n" +
      "FOR EACH BLOOM LEVEL, DESIGN SCENARIO-BASED QUESTIONS WITH THESE SPECIFIC CHARACTERISTICS:\n" +
      "\n" +
      "KNOWLEDGE (recall & recognition):\n" +
      "- Every question MUST start with a scenario: describe a situation where a person encounters the concept, then ask them to identify/recall the correct fact or term within that context.\n" +
      "- Example stem: 'A student reads a textbook chapter and sees the term X used. Based on the context described, what does X refer to?'\n" +
      "- Correct answers are factually correct; distractors are plausible but incorrect.\n" +
      "\n" +
      "UNDERSTANDING (explaining & interpreting):\n" +
      "- Every question MUST start with a scenario: describe an observation or situation, then ask the learner to explain, classify, or interpret what is happening.\n" +
      "- Example stem: 'A technician observes that Y occurs after step Z. How should the technician best explain this outcome to their manager?'\n" +
      "- Requires the learner to demonstrate comprehension within the described context.\n" +
      "\n" +
      "APPLICATION (applying to scenarios):\n" +
      "- Every question MUST present a concrete work or real-world situation, then ask students to apply the concept to solve or act on it.\n" +
      "- Example stem: 'A project manager faces problem P. Using concept C, what should they do first?'\n" +
      "- Answers show practical use of knowledge within the given scenario.\n" +
      "\n" +
      "ANALYSIS (breaking down & comparing):\n" +
      "- Every question MUST present a scenario with multiple components or a described system, then ask students to identify relationships, distinguish elements, or examine assumptions.\n" +
      "- Example stem: 'A team reviews a process where A leads to B which leads to C. What is the most likely root cause of the observed failure?'\n" +
      "- Requires analytical thinking about the scenario's structure, cause, or interdependencies.\n" +
      "\n" +
      "EVALUATION (judging & justifying):\n" +
      "- Every question MUST present a scenario with competing approaches or a proposed course of action, then ask students to judge which is most justified.\n" +
      "- Example stem: 'A company is deciding between approach X and approach Y to solve problem P. Which approach is better supported by the evidence?'\n" +
      "- Requires reasoning and justification against criteria visible in the scenario.\n" +
      "\n" +
      "CREATION (designing & synthesizing):\n" +
      "- Every question MUST present a scenario with a gap or challenge, then ask students to design, propose, or synthesize a solution.\n" +
      "- Example stem: 'An organization needs to accomplish goal G but has constraints A and B. Which proposed design best addresses all requirements?'\n" +
      "- Requires original thinking and integration of multiple concepts from the scenario.\n" +
      "\n" +
      "CRITICAL REQUIREMENTS:\n" +
      "1. EVERY question — at EVERY Bloom level — MUST contain a mini-scenario or situational context in the question stem. Questions without a scenario are INVALID and must not appear in the output.\n" +
      "2. Every question must be tagged with EXACTLY ONE bloomLevel from the list above.\n" +
      `3. For each segment, every enabled Bloom level must receive ${MIN_BLOOM_QUESTIONS_PER_SEGMENT} to ${MAX_BLOOM_QUESTIONS_PER_SEGMENT} questions.\n` +
      "4. Each question must be designed to test the cognitive level, not just labeled.\n" +
      "5. Ensure scenario variety and application variety; avoid repeating the same domain template in most questions.\n" +
      "\n" +
      "OPTION LENGTH RULES (strict):\n" +
      "- Every answer option must be 8-20 words long.\n" +
      "- The correct answer must NOT be longer than any distractor.\n" +
      "- Write all four options at the same level of specificity and detail.\n" +
      "- A student comparing only option lengths must not be able to identify the correct answer.\n" +
      "- For Yes/No, True/False, or binary questions, provide exactly 2 options only.\n" +
      "\n" +
      "OUTPUT FORMAT:\n" +
      "Return questions as JSON array. Each question must have:\n" +
      "{\n" +
      '  "segmentNumber": 1,\n' +
      '  "bloomLevel": "knowledge|understanding|application|analysis|evaluation|creation",\n' +
      '  "question": { "text": "...", "type": "SOL|SML|NAT|DES|BIN", "bloomLevel": "..." },\n' +
      '  "options": [...],\n' +
      '  "solution": { "correctLotItem": {...} | "correctLotItems": [...], "incorrectLotItems": [...] }\n' +
      "}",
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
    await waitForSSEEvent(jobId, "SEGMENTATION");
    let segMap = await fetchLatestSegmentationMap(jobId);
    addLog("Checking segmentation coverage against transcript end…");
    const segMapBeforeCoverage = segMap;
    segMap = await ensureSegmentationCoversTranscriptEnd(jobId, segMap);
    if (segMap.length > segMapBeforeCoverage.length) {
      const previousEnd = segMapBeforeCoverage[segMapBeforeCoverage.length - 1] ?? 0;
      const correctedEnd = segMap[segMap.length - 1] ?? previousEnd;
      addLog(`Adjusted final segment boundary from ${previousEnd.toFixed(1)}s to ${correctedEnd.toFixed(1)}s to cover full video.`);
    } else {
      addLog("Segmentation coverage check complete ✓");
    }
    let numSegments: number | null = segMap.length || null;
    if (numSegments) setSegmentCount(numSegments);
    addLog(`Segmentation complete ✓ — ${numSegments ?? "?"} segments found`);

    // Quiz-worthy check: ensure no segment is too short to support 15 questions
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
        await waitForSSEEvent(jobId, "SEGMENTATION", 12 * 60 * 1000, true);
        segMap = await fetchLatestSegmentationMap(jobId);
        addLog("Re-checking segmentation coverage against transcript end…");
        const segMapBeforeCoverageRetry = segMap;
        segMap = await ensureSegmentationCoversTranscriptEnd(jobId, segMap);
        if (segMap.length > segMapBeforeCoverageRetry.length) {
          const previousEnd = segMapBeforeCoverageRetry[segMapBeforeCoverageRetry.length - 1] ?? 0;
          const correctedEnd = segMap[segMap.length - 1] ?? previousEnd;
          addLog(`Adjusted final segment boundary from ${previousEnd.toFixed(1)}s to ${correctedEnd.toFixed(1)}s after re-segmentation.`);
        } else {
          addLog("Re-segmentation coverage check complete ✓");
        }
        numSegments = segMap.length || numSegments;
        if (numSegments) setSegmentCount(numSegments);
        addLog(`Re-segmentation complete ✓ — ${numSegments ?? "?"} segments found`);
      }
    }

    // ── Stage 4: Question generation ──
    setPipelineStep("QUESTION_GENERATION");
    const generationPlan = buildSmartBloomGenerationPlan(segMap, activeBloomKeys);
    const perSegmentQuestionTargets = generationPlan.perSegmentBloomTargets.map(
      (count) => count * activeBloomKeys.length,
    );
    setTotalQuestions(generationPlan.totalQuestions);
    addLog(
      `Generating ${generationPlan.totalQuestions} questions for ${numSegments ?? "?"} segment(s) with ${generationPlan.totalPerBloomLevel} per enabled Bloom level overall…`,
    );
    await aiSectionAPI.approveContinueTask(jobId);
    await aiSectionAPI.approveStartTask(jobId, {
      type: "QUESTION_GENERATION",
      parameters: getQuestionGenerationParams(
        generationPlan.totalQuestions,
        generationPlan.segmentInstructionBlock,
      ),
    });
    const qResult = await waitForSSEEvent(jobId, "QUESTION_GENERATION");
    addLog("Question generation complete ✓ — loading results…");
    disconnectSSE();

    // ── Progressive segment reveal ──
    // The fileUrl is delivered directly in the SSE COMPLETED event payload.
    const generated = await fetchLatestQuestionResults(jobId, qResult?.fileUrl as string | undefined, {
      segmentMap: segMap,
      perSegmentQuestionTargets,
    });

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

    const seenQuestionKeys = new Set<string>();

    for (let i = 0; i < sortedSegIds.length; i++) {
      if (i > 0) await new Promise<void>((r) => setTimeout(r, 450));
      const segId = sortedSegIds[i];
      const segQs = groups.get(segId)!;
      const uniqueSegmentQuestions = segQs.filter((question) => {
        const key = `${question.segmentId}::${question.bloomLevel ?? 'unclassified'}::${question.text}`;
        if (!question.text || seenQuestionKeys.has(key)) {
          return false;
        }
        seenQuestionKeys.add(key);
        return true;
      });
      if (uniqueSegmentQuestions.length === 0) {
        continue;
      }
      mergeQuestions(uniqueSegmentQuestions);
      setRevealedSegmentCount((prev) => Math.max(prev, i + 1));
      addLog(`Segment ${i + 1} ready — ${uniqueSegmentQuestions.length} questions available`);
      if (i === 0) {
        // Open curation immediately so the user can start swiping segment 1
        // while the remaining segments are still streaming in.
        aiCurationStartedRef.current = true;
        setPipelineStep("CURATION_READY");
        toast.success(`Segment 1 ready — start swiping! More segments loading…`);
      }
    }

    if (sortedSegIds.length > 1) {
      toast.success(`All ${sortedSegIds.length} segments ready for curation.`);
    }
  };

  // ── Direct path (no AI server) ──────────────────────────────────────────────

  /** Ask the instructor for a transcript (file or pasted text); resolves null if they cancel. */
  const requestTranscriptFile = (message: string) =>
    new Promise<TranscriptInput | null>((resolve) => {
      transcriptFileResolverRef.current = resolve;
      setTranscriptPrompt(message);
    });

  const resolveTranscriptFile = (input: TranscriptInput | null) => {
    const resolve = transcriptFileResolverRef.current;
    transcriptFileResolverRef.current = null;
    setTranscriptPrompt(null);
    resolve?.(input);
  };

  /**
   * Transcribe the instructor's copy of the video (or its audio) in this browser.
   * Resolves null when it fails or is cancelled, so the caller asks again.
   */
  const transcribeInBrowser = async (file: File, model: string): Promise<TranscriptChunk[] | null> => {
    const controller = new AbortController();
    mediaAbortRef.current = controller;
    const modelLabel = BROWSER_WHISPER_MODELS.find((m) => m.id === model)?.label ?? model;
    addLog(`Transcribing ${file.name} in this browser (${modelLabel})…`);
    const startedAt = Date.now();
    setMediaProgress({ stage: "decoding" });
    try {
      const chunks = await transcribeMediaFile(file, {
        model,
        signal: controller.signal,
        onProgress: setMediaProgress,
      });
      const lastEnd = chunks[chunks.length - 1].timestamp[1];
      const minutes = ((Date.now() - startedAt) / 60_000).toFixed(1);
      addLog(
        `Transcript made from ${file.name} ✓ — ${chunks.length} timed lines up to ${formatClock(lastEnd)} ` +
          `(took ${minutes} min)`,
      );
      return chunks;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        addLog("Browser transcription cancelled.");
      } else {
        const message = error instanceof Error ? error.message : "Browser transcription failed.";
        addLog(message);
        toast.error(message);
      }
      return null;
    } finally {
      if (mediaAbortRef.current === controller) mediaAbortRef.current = null;
      setMediaProgress(null);
    }
  };

  /**
   * The instructor supplies the transcript: pasted from YouTube's "Show
   * transcript" panel, a file in any layout with timestamps (the server finds
   * them), or the video/audio itself, transcribed in the browser. Keep asking
   * until one works, or the instructor cancels.
   */
  const loadDirectTranscript = async (versionId: string): Promise<{ chunks: TranscriptChunk[] }> => {
    const message = "The AI server is unavailable, so Smart Bloom needs this video's transcript from you.";
    addLog("Waiting for the transcript…");
    for (;;) {
      const input = await requestTranscriptFile(message);
      if (!input) throw new Error("Transcript not provided, so Smart Bloom stopped.");
      if (input.kind === "media") {
        const chunks = await transcribeInBrowser(input.file, input.model);
        if (chunks) return { chunks };
        continue;
      }
      setIsReadingTranscriptFile(true);
      try {
        const label = input.kind === "file" ? input.file.name : "pasted text";
        const content = input.kind === "file" ? await readTranscriptFile(input.file) : input.text;
        const { transcript } = await smartBloomDirectAPI.transcript(versionId, content);
        const chunks = transcript?.chunks ?? [];
        if (chunks.length) {
          const lastStart = chunks[chunks.length - 1].timestamp[0];
          addLog(`Transcript read from ${label} ✓ — ${chunks.length} timed lines up to ${formatClock(lastStart)}`);
          setPastedTranscript("");
          return { chunks };
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not read this transcript.");
      } finally {
        setIsReadingTranscriptFile(false);
      }
    }
  };

  /** Generate one segment's questions and shape them like the AI-server results. */
  const generateDirectSegmentQuestions = async (
    segmentIndex: number,
    segMap: number[],
    perBloomLevel: number,
    instructions?: string,
  ): Promise<CuratedQuestion[]> => {
    const versionId = currentCourse?.versionId;
    if (!versionId) throw new Error("Missing course version");
    const start = segmentIndex === 0 ? 0 : segMap[segmentIndex - 1];
    const end = segMap[segmentIndex];
    const segmentText = textInWindow(directTranscriptRef.current, start, end);
    if (!segmentText) {
      addLog(`Segment ${segmentIndex + 1} has no spoken content — skipped.`);
      return [];
    }

    const result = await smartBloomDirectAPI.generateQuestions({
      versionId,
      segmentNumber: segmentIndex + 1,
      startSeconds: start,
      endSeconds: end,
      segmentText,
      bloomTargets: Object.fromEntries(activeBloomKeys.map((key) => [key, perBloomLevel])),
      questionTypes: activeQuestionTypes,
      instructions,
    });
    if (result.failedLevels.length) {
      addLog(`Segment ${segmentIndex + 1}: ${result.failedLevels.join(", ")} questions could not be generated.`);
    }

    // Stamp each question with its segment END time (this page's segment id) and
    // normalise against this one segment only, so nothing is redistributed.
    const stamped = result.questions.map((question) => ({ ...question, segmentId: end }));
    return normalizeQuestionPayload(stamped, { segmentMap: [end] }).map((question) => ({
      ...question,
      id: `direct-${end}-${directQuestionSeqRef.current++}`,
    }));
  };

  const runDirectPipeline = async (reason: string) => {
    const versionId = currentCourse?.versionId;
    if (!versionId) throw new Error("Missing course or version information");

    setPipelineMode("DIRECT");
    setCreatedJobId(null);
    setQuestions([]);
    setAcceptedQuestionIds(new Set());
    setRejectedQuestionIds(new Set());
    setSegmentCount(null);
    setRevealedSegmentCount(0);
    addLog(`AI server unavailable (${reason}). Continuing without it: your transcript + MiniMax.`);

    // Check the server can generate questions before asking the instructor for anything.
    const { minimaxConfigured } = await smartBloomDirectAPI.status();
    if (!minimaxConfigured) {
      throw new Error(
        "The AI server is unavailable, and the backup (direct mode) is not set up on this server: " +
          "MINIMAX_API_KEY is missing from the backend environment. Ask the platform admin to add it, " +
          "or try again when the AI server is back.",
      );
    }
    toast.info("AI server unavailable — continuing in direct mode.");

    // ── Transcript ──
    setPipelineStep("TRANSCRIPT_GENERATION");
    const { chunks } = await loadDirectTranscript(versionId);
    directTranscriptRef.current = chunks;

    // ── Segmentation ──
    setPipelineStep("SEGMENTATION");
    addLog("Segmenting content…");
    const segmentation = await smartBloomDirectAPI.segment({
      versionId,
      chunks,
      strategy: segmentationStrategy,
      minSegmentSeconds: MIN_SEGMENT_DURATION_SECONDS,
    });
    if (segmentation.warning) addLog(segmentation.warning);
    const segMap = segmentation.segmentMap;
    directSegmentMapRef.current = segMap;
    setSegmentCount(segMap.length);
    addLog(`Segmentation complete ✓ — ${segMap.length} segments found`);

    // ── Questions, one segment at a time, revealed as each finishes ──
    setPipelineStep("QUESTION_GENERATION");
    const plan = buildSmartBloomGenerationPlan(segMap, activeBloomKeys);
    setTotalQuestions(plan.totalQuestions);
    const instructions = getQuestionGenerationParams(plan.totalQuestions, plan.segmentInstructionBlock).prompt;
    addLog(`Generating about ${plan.totalQuestions} questions for ${segMap.length} segment(s)…`);

    let generatedTotal = 0;
    let curationOpened = false;
    for (let i = 0; i < segMap.length; i++) {
      addLog(`Generating questions for segment ${i + 1}…`);
      let generated: CuratedQuestion[] = [];
      try {
        generated = await generateDirectSegmentQuestions(
          i,
          segMap,
          plan.perSegmentBloomTargets[i] ?? DEFAULT_BLOOM_QUESTIONS_PER_SEGMENT,
          instructions,
        );
      } catch (error) {
        // A setup problem affects every segment: stop instead of repeating it.
        if (error instanceof DirectApiError && error.status === 503) throw error;
        const msg = error instanceof Error ? error.message : "Unknown error";
        addLog(`Segment ${i + 1} failed: ${msg}`);
      }
      generatedTotal += generated.length;
      if (generated.length) mergeQuestions(generated);
      setRevealedSegmentCount(i + 1);
      addLog(`Segment ${i + 1}: ${generated.length} questions available`);
      if (!curationOpened && generated.length) {
        curationOpened = true;
        setPipelineStep("CURATION_READY");
        toast.success(`Segment ${i + 1} ready — start swiping! More segments loading…`);
      }
    }

    if (generatedTotal === 0) {
      throw new Error("No questions could be generated for any segment. See the log above for the reason.");
    }
    if (segMap.length > 1) {
      toast.success(`All ${segMap.length} segments ready for curation.`);
    }
  };

  const requestDirectRefillForSegment = async (segmentId: number) => {
    if (isRefilling) return;
    const segMap = directSegmentMapRef.current;
    const segmentIndex = segMap.indexOf(segmentId);
    if (segmentIndex === -1) return;

    const activeCount = questions.filter((q) => q.segmentId === segmentId && !rejectedQuestionIds.has(q.id)).length;
    if (activeCount >= MIN_ACTIVE_QUESTIONS_PER_SEGMENT) return;
    const needed = MIN_ACTIVE_QUESTIONS_PER_SEGMENT - activeCount;

    setIsRefilling(true);
    try {
      const perLevel = Math.max(1, Math.ceil(Math.max(needed, 3) / Math.max(1, activeBloomKeys.length)));
      const generated = await generateDirectSegmentQuestions(
        segmentIndex,
        segMap,
        perLevel,
        getQuestionGenerationParams(Math.max(needed, 3)).prompt,
      );
      mergeQuestions(generated);
      toast.success(`Fetched additional questions for segment ${segmentIndex + 1}`);
    } catch (error) {
      console.error("Direct refill failed", error);
      toast.error("Could not auto-refill questions for this segment");
    } finally {
      setIsRefilling(false);
    }
  };

  const requestRefillForSegment = async (segmentId: number) => {
    if (pipelineMode === "DIRECT") {
      await requestDirectRefillForSegment(segmentId);
      return;
    }
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
      const generated = await fetchLatestQuestionResults(createdJobId, qResult?.fileUrl as string | undefined, {
        segmentMap: [segmentId],
        perSegmentQuestionTargets: [Math.max(needed, 3)],
      });
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
    const normalizedOptions = enforceBinaryOptionLimit(question.text, uniqueOptions(question.options.length > 0 ? question.options : [
      ...(question.raw?.solution?.correctLotItems || []).map((o: any) => o?.text),
      question.raw?.solution?.correctLotItem?.text,
      ...(question.raw?.solution?.incorrectLotItems || []).map((o: any) => o?.text),
    ]));

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

    const cleanedOptions = enforceBinaryOptionLimit(editText, uniqueOptions(editOptions));
    if (cleanedOptions.length < 2) {
      toast.error("At least two unique options are required.");
      return;
    }

    const validCorrectIndexes = editCorrectOptionIndexes
      .filter((idx) => idx >= 0 && idx < cleanedOptions.length)
      .filter((idx, i, arr) => arr.indexOf(idx) === i);

    const isBinary = isBinaryQuestionText(editText) ||
      (cleanedOptions.length === 2 && cleanedOptions.every((opt) => getBinaryPolarity(opt) !== null));

    const correctIndexes = isBinary
      ? [validCorrectIndexes.length > 0 ? validCorrectIndexes[0] : 0]
      : validCorrectIndexes.length > 0
        ? validCorrectIndexes
        : [0];

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
    const hasSource = pipelineMode === "DIRECT" || Boolean(createdJobId);
    if (!hasSource || !currentCourse?.courseId || !currentCourse?.versionId || !currentCourse?.moduleId || !currentCourse?.sectionId) {
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
        queryKey: ["get", "/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items"],
      });

      await queryClient.invalidateQueries({
        queryKey: ["get", "/courses/versions/{id}"],
      });

      await queryClient.refetchQueries({
        queryKey: ["get", "/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items"],
        type: "active",
      });

      await queryClient.refetchQueries({
        queryKey: ["get", "/courses/versions/{id}"],
        type: "active",
      });
    };

    if (pipelineMode === "DIRECT") {
      setIsUploading(true);
      setPipelineStep("UPLOAD_CONTENT");
      addLog("Starting content upload…");
      try {
        const summary = await smartBloomDirectAPI.upload({
          versionId: currentCourse.versionId,
          moduleId: currentCourse.moduleId,
          sectionId: currentCourse.sectionId,
          videoUrl: youtubeUrl.trim(),
          segmentMap: directSegmentMapRef.current,
          questions: curated,
          distribution,
          videoItemBaseName: "video_item",
          quizItemBaseName: "quiz_item",
        });
        addLog(
          `Upload complete ✓ — ${summary.questionsCreated} questions in ${summary.quizItems} quiz(zes)` +
            (summary.questionsSkipped ? `, ${summary.questionsSkipped} could not be saved` : ""),
        );
        await refreshTeacherContentCache();
        setPipelineStep("COMPLETED");
        toast.success("Curated questions uploaded successfully. Teacher content refreshed.");
        onUploadComplete?.(currentCourse.moduleId, currentCourse.sectionId);
      } catch (error) {
        console.error(error);
        const msg = error instanceof Error ? error.message : "Unknown error";
        addLog(`Upload failed: ${msg}`);
        toast.error("Failed to upload curated questions");
        setPipelineStep("CURATION_READY");
      } finally {
        setIsUploading(false);
      }
      return;
    }

    if (!createdJobId) return;
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

    if (activeQuestionTypes.length === 0) {
      toast.error("Select at least one question type.");
      return;
    }

    setIsSubmitting(true);
    setStatusLog([]);
    setSegmentCount(null);
    setRevealedSegmentCount(0);
    setQuestions([]);
    setAcceptedQuestionIds(new Set());
    setRejectedQuestionIds(new Set());
    setPipelineMode("AI_SERVER");
    setPipelineError(null);
    aiCurationStartedRef.current = false;
    directTranscriptRef.current = [];
    directSegmentMapRef.current = [];
    try {
      const questionGenerationParameters = {
        ...allocateQuestionTypes(totalQuestions, activeQuestionTypes),
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
      disconnectSSE();

      // The AI server failed before curation began: carry on without it.
      if (!aiCurationStartedRef.current) {
        try {
          await runDirectPipeline(msg.length > 140 ? `${msg.slice(0, 140)}…` : msg);
          return;
        } catch (directError) {
          console.error("Smart Bloom direct mode failed:", directError);
          const directMsg = directError instanceof Error ? directError.message : "Unknown error";
          addLog(`Error: ${directMsg}`);
          toast.error("Smart Bloom could not continue — see the details below.");
          setPipelineError(directMsg);
          setTranscriptPrompt(null);
          setPipelineStep("IDLE");
          return;
        }
      }

      addLog(`Error: ${msg}`);
      toast.error("Smart Bloom could not continue — see the details below.");
      setPipelineError(msg);
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
            <p className="text-sm font-medium mb-2">Question Types</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              {ALL_QUESTION_TYPES.map((type) => (
                <label key={type} className="inline-flex items-start gap-2 cursor-pointer rounded-md border p-2 bg-background/50">
                  <input
                    type="checkbox"
                    checked={questionTypeEnabled[type]}
                    onChange={() => toggleQuestionType(type)}
                    className="h-4 w-4 mt-0.5"
                  />
                  <span>
                    <span className="font-medium block">{QUESTION_TYPE_META[type].label}</span>
                    <span className="text-xs text-muted-foreground">{QUESTION_TYPE_META[type].description}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Selected types are converted into generation counts using equal split and remainder balancing.
            </p>
          </div>

          <div className="rounded-lg border p-4 bg-muted/20">
            <h3 className="text-sm font-semibold mb-3">Question type allocation preview</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              {ALL_QUESTION_TYPES.map((type) => (
                <div key={type} className="rounded-md border p-3">
                  <div className="text-muted-foreground">{type}</div>
                  <div className="text-xl font-semibold">{questionTypeBreakdown[type]}</div>
                </div>
              ))}
            </div>
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
          {(pipelineStep !== "IDLE" || pipelineError) && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Pipeline Progress</h3>
                <div className="flex items-center gap-2">
                  {pipelineMode === "DIRECT" && (
                    <Badge
                      variant="outline"
                      title="The AI server was unavailable. The transcript comes from you (pasted or uploaded), and questions from MiniMax."
                    >
                      Direct mode
                    </Badge>
                  )}
                  {segmentCount && (
                    <Badge variant="outline">{segmentCount} segments detected</Badge>
                  )}
                </div>
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

              {/* Upload wait indicator */}
              {pipelineStep === "UPLOAD_CONTENT" && (
                <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/30">
                  <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-300">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span className="font-medium">Content is getting uploaded. Please wait…</span>
                  </div>
                  <p className="mt-1 text-xs text-blue-700/90 dark:text-blue-300/80">
                    We are finalizing upload and refreshing course content. This can take a few moments.
                  </p>
                </div>
              )}

              {/* Transcript needed from the instructor (direct mode) */}
              {transcriptPrompt && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 space-y-3 dark:border-amber-900 dark:bg-amber-950/30">
                  <div className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span className="font-medium">{transcriptPrompt}</span>
                  </div>

                  <div className="space-y-1 text-xs text-amber-900 dark:text-amber-200">
                    <p className="font-medium">Copy the transcript from YouTube:</p>
                    <ol className="list-decimal pl-5 space-y-0.5 text-amber-800/90 dark:text-amber-300/80">
                      <li>
                        <a
                          href={youtubeUrl.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline font-medium"
                        >
                          Open the video on YouTube
                        </a>{" "}
                        (opens in a new tab).
                      </li>
                      <li>Below the video, click <span className="font-medium">…more</span> to expand the description.</li>
                      <li>
                        Scroll to the end of the description and click <span className="font-medium">Show transcript</span>.
                      </li>
                      <li>
                        Keep the timestamps visible. If you only see text, open the <span className="font-medium">⋮</span> menu
                        at the top of the transcript and choose <span className="font-medium">Toggle timestamps</span>.
                      </li>
                      <li>
                        Click just before the first timestamp, scroll to the end, hold <span className="font-medium">Shift</span>{" "}
                        and click after the last line, then copy (Ctrl+C, or ⌘C on a Mac).
                      </li>
                      <li>
                        Paste it below and click <span className="font-medium">Use pasted transcript</span>.
                      </li>
                    </ol>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="smart-bloom-transcript-paste" className="text-xs text-amber-900 dark:text-amber-200">
                      Paste the transcript here
                    </Label>
                    <Textarea
                      id="smart-bloom-transcript-paste"
                      rows={6}
                      className="bg-background font-mono text-xs"
                      placeholder={"0:00\nWelcome to today's lecture…\n0:12\nWe begin with…"}
                      value={pastedTranscript}
                      disabled={isReadingTranscriptFile}
                      onChange={(e) => setPastedTranscript(e.target.value)}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        disabled={isReadingTranscriptFile || !pastedTranscript.trim()}
                        onClick={() => resolveTranscriptFile({ kind: "text", text: pastedTranscript })}
                      >
                        Use pasted transcript
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isReadingTranscriptFile}
                        onClick={() => resolveTranscriptFile(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>

                  <details className="text-xs text-amber-800/90 dark:text-amber-300/80">
                    <summary className="cursor-pointer select-none">Have a transcript file instead?</summary>
                    <div className="mt-2 space-y-1.5">
                      <p>
                        Any file with timestamps works: subtitles (.srt, .vtt), Word, Excel/CSV, or exports from Zoom,
                        Teams or Otter.
                      </p>
                      <Input
                        type="file"
                        accept=".srt,.vtt,.sbv,.txt,.csv,.tsv,.json,.docx,.xlsx,.xls,.ods,.md,text/*"
                        className="max-w-xs bg-background"
                        disabled={isReadingTranscriptFile}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) resolveTranscriptFile({ kind: "file", file });
                        }}
                      />
                    </div>
                  </details>

                  <details className="text-xs text-amber-800/90 dark:text-amber-300/80">
                    <summary className="cursor-pointer select-none">
                      Have the video or its audio on this computer? Make the transcript here
                    </summary>
                    <div className="mt-2 space-y-2">
                      <p>
                        The file stays on this computer: it is transcribed in this browser, not uploaded. The speech
                        model downloads once (about{" "}
                        {BROWSER_WHISPER_MODELS.find((m) => m.id === whisperModel)?.downloadMB ?? 80} MB) and a long
                        lecture can take a while, so keep this tab open. English speech only. Up to 1 GB; for bigger
                        videos, upload just the audio (M4A or MP3).
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Label htmlFor="smart-bloom-whisper-model" className="text-xs">
                          Speech model
                        </Label>
                        <select
                          id="smart-bloom-whisper-model"
                          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                          value={whisperModel}
                          disabled={isReadingTranscriptFile}
                          onChange={(e) => setWhisperModel(e.target.value)}
                        >
                          {BROWSER_WHISPER_MODELS.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Input
                        type="file"
                        accept="video/*,audio/*"
                        className="max-w-xs bg-background"
                        disabled={isReadingTranscriptFile}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) resolveTranscriptFile({ kind: "media", file, model: whisperModel });
                        }}
                      />
                    </div>
                  </details>
                </div>
              )}

              {/* In-browser transcription of the instructor's video/audio (direct mode) */}
              {mediaProgress && (
                <div className="rounded-md border px-3 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {mediaProgress.stage === "decoding" && "Reading the audio from your file…"}
                      {mediaProgress.stage === "loading-model" &&
                        `Downloading the speech model (first time only)… ${mediaProgress.percent}%`}
                      {mediaProgress.stage === "transcribing" &&
                        `Transcribing… ${formatClock(mediaProgress.processedSeconds)} of ${formatClock(mediaProgress.totalSeconds)}`}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => mediaAbortRef.current?.abort()}>
                      Cancel
                    </Button>
                  </div>
                  {mediaProgress.stage !== "decoding" && (
                    <Progress
                      value={
                        mediaProgress.stage === "loading-model"
                          ? mediaProgress.percent
                          : mediaProgress.totalSeconds
                            ? (mediaProgress.processedSeconds / mediaProgress.totalSeconds) * 100
                            : 0
                      }
                    />
                  )}
                  <p className="text-xs text-muted-foreground">Keep this tab open until it finishes.</p>
                </div>
              )}
              {isReadingTranscriptFile && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Reading transcript file…
                </div>
              )}

              {/* Why the run stopped; stays until the next run */}
              {pipelineError && pipelineStep === "IDLE" && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/30">
                  <div className="flex items-start gap-2 text-sm text-red-800 dark:text-red-300">
                    <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">Smart Bloom stopped</p>
                      <p className="mt-0.5 text-xs">{pipelineError}</p>
                    </div>
                  </div>
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

              {isUploading && (
                <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-2 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  Content upload in progress. Please wait while we process and refresh.
                </div>
              )}

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
                          <div className="flex items-center gap-2 text-xs flex-wrap">
                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-medium">
                              Segment {activeSegmentIndex + 1}
                            </span>
                            {(currentQuestion.raw?.questionType || currentQuestion.raw?.question?.type) && (
                              <span className="bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full font-medium">
                                {currentQuestion.raw?.questionType ?? currentQuestion.raw?.question?.type}
                              </span>
                            )}
                            {currentQuestion.bloomLevel && (
                              <span
                                className={cn(
                                  "px-2 py-1 rounded-full font-medium capitalize",
                                  BLOOM_LEVEL_BADGE_CLASSES[currentQuestion.bloomLevel],
                                )}
                              >
                                {currentQuestion.bloomLevel === "unclassified"
                                  ? "Unclassified"
                                  : BLOOM_LEVEL_META[currentQuestion.bloomLevel as BloomKey].label}
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
