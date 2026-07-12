"use client";

import {useEffect, useRef, useState} from "react";
import {useCompanionStore} from "@/store/companion-store";
import type {CompanionAnimal, CompanionMood} from "@/types/companion";
import {createCompanionRenderer, MSGS} from "./companionRenderer";
import {apiClient} from "@/lib/api-client";

type PrototypeMood = keyof typeof MSGS;

// ── Animal + mood config ─────────────────────────────────────────────────

// Stage names + emojis, kept in sync with `STAGES[]` in companionRenderer.js
// (which mirrors `vibe_companions (2).html`). The dashboard displays the
// named stage instead of the raw numeric index.
const STAGE_NAMES = ["Baby", "Toddler", "Child", "Teen", "Young Adult", "Adult"] as const;
const STAGE_EMOJIS = ["🥚", "🐣", "🌱", "🌿", "🌸", "⭐"] as const;

const ANIMALS: {id: CompanionAnimal; emoji: string; label: string}[] = [
  {id: "panda", emoji: "🐼", label: "Panda"},
  {id: "fox", emoji: "🦊", label: "Fox"},
  {id: "penguin", emoji: "🐧", label: "Penguin"},
  {id: "dog", emoji: "🐶", label: "Dog"},
  {id: "cat", emoji: "🐱", label: "Cat"},
];

// Backend moods → prototype moods used by the renderer.
// Mirrors prototype AMOOD(p,i) priority: celebrating>sleeping>angry>sad>excited>happy.
// studying is a live signal — the renderer gets it directly when the backend pushes it.
function toPrototypeMood(backendMood: CompanionMood, progress: number): PrototypeMood {
  if (progress >= 100) return "celebrating";
  switch (backendMood) {
    case "happy":
      return "happy";
    case "angry":
      return "angry";
    case "sad":
      return "sad";
    case "excited":
      return "excited";
    case "sleeping":
      return "sleeping";
    case "studying":
      return "studying";
    case "neutral":
      return "neutral";
    case "newJourney":
      return "newJourney";
  }
}

// ── Canvas sub-component ────────────────────────────────────────────────
// Owns the renderer lifecycle so the canvas only mounts when the user
// has already picked an animal.

function CompanionCanvas({
  animal,
  mood,
  progress,
  idleDays,
  quizScore,
}: {
  animal: CompanionAnimal;
  mood: CompanionMood;
  progress: number;
  idleDays: number;
  quizScore: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof createCompanionRenderer> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mount renderer once.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setError("Canvas ref missing — not mounted in DOM");
      return;
    }

    try {
      const safeAnimal = (
        animal === "panda" ||
        animal === "fox" ||
        animal === "penguin" ||
        animal === "dog" ||
        animal === "cat"
      ) ? animal : "panda";

      if (import.meta.env.DEV && safeAnimal !== animal) {
        // Defensive guard for unexpected animal strings — only log in dev.
        console.warn(`[CompanionCanvas] unexpected animal "${animal}", falling back to "${safeAnimal}"`);
      }

      const renderer = createCompanionRenderer(canvas, {
        animal: safeAnimal,
        mood: toPrototypeMood(mood, progress),
        prog: progress,
        idle: idleDays,
        quiz: quizScore,
      });
      renderer.start();
      rendererRef.current = renderer;
    } catch (e) {
      const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ""}` : String(e);
      console.error("[CompanionCanvas] renderer boot failed:", msg);
      setError(msg);
    }

    return () => {
      try {
        rendererRef.current?.stop();
      } catch {
        /* ignore cleanup errors */
      }
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Propagate prop changes into the live renderer without remounting.
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    const safeAnimal = (
      animal === "panda" ||
      animal === "fox" ||
      animal === "penguin" ||
      animal === "dog" ||
      animal === "cat"
    ) ? animal : "panda";
    r.setAnimal(safeAnimal);
    r.setMood(toPrototypeMood(mood, progress));
    r.setProg(progress);
    r.setIdle(idleDays);
    r.setQuiz(quizScore);
  }, [animal, mood, progress, idleDays, quizScore]);

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 max-w-xs">
        <strong>Companion render error:</strong>
        <pre className="whitespace-pre-wrap text-[10px] mt-1">{error}</pre>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={360}
      className="rounded-lg"
      style={{maxWidth: "100%", height: "auto"}}
    />
  );
}

// ── Message sub-component ───────────────────────────────────────────────
// Renders a small speech-bubble line under the canvas showing what the
// companion "says" given the current mood + progress. Auto-updates when:
//   - the active mood changes (mood or progress crosses a bucket boundary)
//   - the user makes fresh progress (every 5%-point band change after that)
//
// This mirrors the prototype behaviour where each `refresh()` re-rolls a
// random message from the active mood's array — surfacing variety as the
// user keeps moving.

function CompanionMessage({
  mood,
  progress,
  override,
}: {
  mood: CompanionMood;
  progress: number;
  override: string | null;
}) {
  const prototypeMood = toPrototypeMood(mood, progress);
  // Re-roll on (a) mood change, (b) every 5% progress band so the message
  // visibly tracks activity even when the mood itself hasn't changed yet,
  // and (c) a fresh `override` string (one-shot "new learning journey"
  // message after a new enrollment drops the average realProgress).
  const progressBucket = Math.floor(progress / 5);
  const [msg, setMsg] = useState<string>("");
  useEffect(() => {
    if (override) {
      setMsg(override);
      return;
    }
    const arr = MSGS[prototypeMood] ?? MSGS.happy;
    setMsg(arr[Math.floor(Math.random() * arr.length)]);
  }, [prototypeMood, progressBucket, override]);

  return (
    <p
      data-testid="companion-message"
      className="text-xs italic text-gray-600 text-center max-w-xs px-2 min-h-[1.5rem]"
    >
      {msg}
    </p>
  );
}

// ── Component ────────────────────────────────────────────────────────────

export function CompanionWidget() {
  const [pickerOpen, setPickerOpen] = useState(false);

  const companion = useCompanionStore((s) => s.companion);
  const hasSelected = useCompanionStore((s) => s.hasSelected);
  const isLoading = useCompanionStore((s) => s.isLoading);
  const error = useCompanionStore((s) => s.error);
  const fetchCompanion = useCompanionStore((s) => s.fetchCompanion);
  const selectAnimal = useCompanionStore((s) => s.selectAnimal);

  // ── "New learning journey" one-shot message ─────────────────────────────
  // realProgress is averaged across all enrollments, so enrolling a new
  // course can drop the companion to an earlier stage even though the
  // student hasn't lost any prior achievement.
  //
  // The backend sets companion.newJourney = true when lastKnownProgress
  // drops by ≥20 points (detected inside updateProgressMeta). The frontend
  // shows one newJourney message, then calls PATCH /me/new-journey-seen
  // to clear the flag server-side on the next poll.
  //
  // Unlike the old session-ref approach, this persists across page
  // refreshes and is server-authoritative (not client-only).
  const [journeyMessage, setJourneyMessage] = useState<string | null>(null);
  const prevNewJourneyRef = useRef(false);
  // Remember the progress value at the moment newJourney fired.
  // The message persists until the user makes forward progress from this point.
  const journeyBaseProgressRef = useRef<number | null>(null);
  useEffect(() => {
    const nj = companion?.newJourney;
    const cp = companion?.realProgress;
    if (nj === true && !prevNewJourneyRef.current) {
      // Fire once — pick a random newJourney message from the renderer
      const arr = MSGS.newJourney ?? ['A new journey starts today! 🌱'];
      const msg = arr[Math.floor(Math.random() * arr.length)];
      setJourneyMessage(msg);
      journeyBaseProgressRef.current = typeof cp === 'number' ? cp : null;
    }
    prevNewJourneyRef.current = nj ?? false;
  }, [companion?.newJourney]);

  // Auto-clear the newJourney message when the user starts making progress.
  // journeyBaseProgressRef stores the progress value at the moment newJourney
  // fired. As soon as realProgress increases (user engaged with the new course),
  // the message clears and normal mood messages resume.
  useEffect(() => {
    if (!journeyMessage) return;
    const base = journeyBaseProgressRef.current;
    if (base === null) return;
    if (typeof companion?.realProgress === 'number' && companion!.realProgress > base) {
      // User has made forward progress — clear the override and acknowledge
      setJourneyMessage(null);
      journeyBaseProgressRef.current = null;
      apiClient.patch('/companion/me/new-journey-seen', {}).catch(() => {});
    }
  }, [companion?.realProgress]);

  // Fetch on mount, then auto-poll every 30s so mood/progress/idle stay fresh
  // without a full page reload (matches the polling interval documented in the
  // store API contract). Polling pauses while the tab is hidden to avoid
  // wasting CPU + bandwidth on a screen the user can't see; the interval
  // resumes immediately when the tab becomes visible again.
  useEffect(() => {
    void fetchCompanion();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchCompanion();
      }
    }, 30_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        // Catch up immediately on tab focus so the widget reflects current
        // state without waiting up to 30s for the next tick.
        void fetchCompanion();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [fetchCompanion]);

  // First-time: just show picker (nothing to render yet).
  if (!hasSelected) {
    return (
      <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl shadow">
        <p className="text-sm text-gray-700">Choose your learning companion</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {ANIMALS.map((a) => (
            <button
              key={a.id}
              disabled={isLoading}
              onClick={async () => {
                await selectAnimal(a.id);
              }}
              className="px-4 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-sm font-medium text-indigo-700"
            >
              <span className="mr-1.5">{a.emoji}</span>
              {a.label}
            </button>
          ))}
        </div>
        {error && (
          <p className="text-xs text-red-600 max-w-xs text-center" data-testid="companion-error">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Active view: always renders the canvas (so it survives a switch).
  // The picker overlays the canvas when re-opening it.
  return (
    <div className="flex flex-col items-center gap-2 p-3 bg-white rounded-xl shadow relative">
      <CompanionCanvas
        animal={companion!.animal}
        mood={companion!.mood}
        progress={companion!.realProgress}
        idleDays={companion!.idleDays}
        quizScore={companion!.quizScore}
      />

      <CompanionMessage
        mood={journeyMessage ? 'newJourney' : companion!.mood}
        progress={companion!.realProgress}
        override={journeyMessage}
      />

      {pickerOpen && (
        <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center gap-3 p-4 rounded-xl">
          <p className="text-sm text-gray-700">Switch your companion</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {ANIMALS.map((a) => (
              <button
                key={a.id}
                disabled={isLoading}
                onClick={async () => {
                  await selectAnimal(a.id);
                  // Close the picker on either success or failure: the store
                  // sets the `error` field on failure, which the dashboard
                  // toast (or future inline error UI) will surface. Leaving
                  // the picker open on every retry would trap users who only
                  // wanted to cancel.
                  setPickerOpen(false);
                }}
                className="px-4 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-sm font-medium text-indigo-700"
              >
                <span className="mr-1.5">{a.emoji}</span>
                {a.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPickerOpen(false)}
            className="text-xs text-gray-500 underline"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-gray-600">
        <span className="font-semibold capitalize">
          {ANIMALS.find((a) => a.id === companion!.animal)?.emoji}{" "}
          {companion!.animal}
        </span>
        <span className="text-gray-300">·</span>
        <span className="capitalize">{journeyMessage ? 'new journey' : companion!.mood}</span>
        <span className="text-gray-300">·</span>
        <span>
          Stage {STAGE_NAMES[companion!.stage] ?? companion!.stage}{" "}
          {STAGE_EMOJIS[companion!.stage] ?? ""}
        </span>
        {companion!.graduationCap && (
          <>
            <span className="text-gray-300">·</span>
            <span title={`Quiz score ${companion!.quizScore} > 85 — graduation cap earned!`}>
              🎓
            </span>
          </>
        )}
      </div>
      {!pickerOpen && (
        <button
          onClick={() => setPickerOpen(true)}
          className="text-xs text-indigo-600 underline"
        >
          Switch animal
        </button>
      )}
    </div>
  );
}

export default CompanionWidget;