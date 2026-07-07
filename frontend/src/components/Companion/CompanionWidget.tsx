"use client";

import {useEffect, useRef, useState} from "react";
import {useCompanionStore} from "@/store/companion-store";
import type {CompanionAnimal, CompanionMood} from "@/types/companion";
import {createCompanionRenderer} from "./companionRenderer";

// ── Animal + mood config ─────────────────────────────────────────────────

const ANIMALS: {id: CompanionAnimal; emoji: string; label: string}[] = [
  {id: "panda", emoji: "🐼", label: "Panda"},
  {id: "fox", emoji: "🦊", label: "Fox"},
  {id: "penguin", emoji: "🐧", label: "Penguin"},
  {id: "dog", emoji: "🐶", label: "Dog"},
  {id: "cat", emoji: "🐱", label: "Cat"},
];

// Backend moods → prototype moods used by the renderer.
function toPrototypeMood(backendMood: CompanionMood, progress: number): string {
  if (progress >= 100) return "celebrating";
  switch (backendMood) {
    case "neutral":
    case "happy":
      return "happy";
    case "studying":
      return "studying";
    case "excited":
      return "excited";
    case "concerned":
    case "worried":
      return "sad";
    case "sleeping":
      return "sleeping";
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

// ── Component ────────────────────────────────────────────────────────────

export function CompanionWidget() {
  const [pickerOpen, setPickerOpen] = useState(false);

  const companion = useCompanionStore((s) => s.companion);
  const hasSelected = useCompanionStore((s) => s.hasSelected);
  const isLoading = useCompanionStore((s) => s.isLoading);
  const error = useCompanionStore((s) => s.error);
  const fetchCompanion = useCompanionStore((s) => s.fetchCompanion);
  const selectAnimal = useCompanionStore((s) => s.selectAnimal);

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
        quizScore={companion!.realQuizScore}
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
        <span className="capitalize">{companion!.mood}</span>
        <span className="text-gray-300">·</span>
        <span>Stage {companion!.stage}</span>
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