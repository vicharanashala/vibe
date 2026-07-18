import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle, XCircle, Loader, AlertTriangle, ArrowLeft } from "lucide-react";

type CheckStatus = "idle" | "checking" | "pass" | "fail" | "warn";

interface Check {
  id: string;
  label: string;
  description: string;
  status: CheckStatus;
  message?: string;
}

export const SYSTEM_CHECK_KEY = "vibe_system_check_passed";

export type SystemCheckResult = "passed" | "warned" | "failed" | "not_run";

export function getSystemCheckResult(): SystemCheckResult {
  return (localStorage.getItem(SYSTEM_CHECK_KEY) as SystemCheckResult) || "not_run";
}

const initialChecks: Check[] = [
  { id: "browser", label: "Browser Compatibility", description: "Chrome, Firefox, Edge, or Safari 15+", status: "idle" },
  { id: "camera", label: "Camera Access", description: "Required for AI proctoring", status: "idle" },
  { id: "microphone", label: "Microphone Access", description: "Required for speech detection", status: "idle" },
  { id: "webgl", label: "WebGL Support", description: "Required for face detection models", status: "idle" },
  { id: "wasm", label: "WebAssembly Support", description: "Required for AI inference", status: "idle" },
  { id: "worker", label: "Web Workers", description: "Required for background processing", status: "idle" },
  { id: "storage", label: "Local Storage", description: "Required for session persistence", status: "idle" },
];

async function runChecks(setChecks: React.Dispatch<React.SetStateAction<Check[]>>) {
  const update = (id: string, status: CheckStatus, message?: string) =>
    setChecks((prev) => prev.map((c) => (c.id === id ? { ...c, status, message } : c)));

  update("browser", "checking");
  const ua = navigator.userAgent;
  const isSupported =
    /Chrome\/(\d+)/.test(ua) ||
    /Firefox\/(\d+)/.test(ua) ||
    /Edg\/(\d+)/.test(ua) ||
    /Version\/1[5-9].*Safari/.test(ua);
  update("browser", isSupported ? "pass" : "warn", isSupported ? "Supported browser detected" : "Use Chrome, Firefox, or Edge for best experience");

  update("wasm", "checking");
  await new Promise((r) => setTimeout(r, 200));
  const wasmSupported = typeof WebAssembly === "object";
  update("wasm", wasmSupported ? "pass" : "fail", wasmSupported ? "WebAssembly supported" : "WebAssembly not available — upgrade your browser");

  update("webgl", "checking");
  await new Promise((r) => setTimeout(r, 200));
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    update("webgl", gl ? "pass" : "fail", gl ? "WebGL supported" : "WebGL not available — AI features will not work");
  } catch {
    update("webgl", "fail", "WebGL check failed");
  }

  update("worker", "checking");
  await new Promise((r) => setTimeout(r, 200));
  update("worker", typeof Worker !== "undefined" ? "pass" : "fail",
    typeof Worker !== "undefined" ? "Web Workers supported" : "Web Workers not available");

  update("storage", "checking");
  await new Promise((r) => setTimeout(r, 200));
  try {
    localStorage.setItem("__vibe_check__", "1");
    localStorage.removeItem("__vibe_check__");
    update("storage", "pass", "Local storage available");
  } catch {
    update("storage", "fail", "Local storage blocked — check browser settings");
  }

  update("camera", "checking");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());
    update("camera", "pass", "Camera access granted");
  } catch (e: any) {
    if (e.name === "NotAllowedError") {
      update("camera", "fail", "Camera permission denied — allow camera access in browser settings");
    } else if (e.name === "NotFoundError") {
      update("camera", "fail", "No camera found — connect a webcam");
    } else {
      update("camera", "warn", "Camera check inconclusive — " + e.message);
    }
  }

  update("microphone", "checking");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    update("microphone", "pass", "Microphone access granted");
  } catch (e: any) {
    if (e.name === "NotAllowedError") {
      update("microphone", "fail", "Microphone permission denied — allow microphone access in browser settings");
    } else if (e.name === "NotFoundError") {
      update("microphone", "warn", "No microphone found — some features may be limited");
    } else {
      update("microphone", "warn", "Microphone check inconclusive — " + e.message);
    }
  }
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "checking") return <Loader className="w-5 h-5 animate-spin text-[rgb(52,152,169)]" />;
  if (status === "pass") return <CheckCircle className="w-5 h-5 text-green-500" />;
  if (status === "fail") return <XCircle className="w-5 h-5 text-red-500" />;
  if (status === "warn") return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
  return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
}

export default function SystemCheckPage() {
  const navigate = useNavigate();
  const [checks, setChecks] = useState<Check[]>(initialChecks);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const start = async () => {
    setRunning(true);
    setDone(false);
    setChecks(initialChecks);
    await runChecks(setChecks);
    setRunning(false);
    setDone(true);
  };

  const hasFail = checks.some((c) => c.status === "fail");
  const hasWarn = checks.some((c) => c.status === "warn");

  // Persist result to localStorage when done
  if (done) {
    const result: SystemCheckResult = hasFail ? "failed" : hasWarn ? "warned" : "passed";
    localStorage.setItem(SYSTEM_CHECK_KEY, result);
  }

  const summary = !done
    ? null
    : hasFail
    ? { label: "Your device has compatibility issues", color: "text-red-600", bg: "bg-red-50 border-red-200" }
    : hasWarn
    ? { label: "Your device is mostly compatible — some features may be limited", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" }
    : { label: "Your device is fully compatible with ViBe!", color: "text-green-700", bg: "bg-green-50 border-green-200" };

  return (
    <div className="min-h-screen bg-[rgb(240,248,250)] flex flex-col">
      <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 py-6 flex items-center gap-4">
        <button
          onClick={() => navigate({ to: "/auth" })}
          className="flex items-center gap-2 text-[rgb(52,152,169)] hover:text-[rgb(25,90,105)] font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[rgb(25,90,105)] mb-2">System Requirements Check</h1>
            <p className="text-[rgba(228,143,57,1)] text-base">
              Verify your device is ready for ViBe's AI proctoring and learning features before logging in.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            {checks.map((check, i) => (
              <div
                key={check.id}
                className={`flex items-start gap-4 px-6 py-4 ${i !== checks.length - 1 ? "border-b border-gray-100" : ""}`}
              >
                <div className="mt-0.5 shrink-0">
                  <StatusIcon status={check.status} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-[rgb(25,90,105)] text-sm">{check.label}</span>
                  <p className="text-xs text-gray-400 mt-0.5">{check.message ?? check.description}</p>
                </div>
              </div>
            ))}
          </div>

          {summary && (
            <div className={`rounded-lg border px-5 py-4 mb-6 ${summary.bg}`}>
              <p className={`font-semibold text-sm ${summary.color}`}>{summary.label}</p>
              {hasFail && (
                <p className="text-xs text-gray-500 mt-1">
                  Fix the issues above before proceeding. Items marked ✕ will prevent ViBe from working correctly.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={start}
              disabled={running}
              className="flex-1 py-3 px-6 rounded-lg bg-[rgb(52,152,169)] hover:bg-[rgb(102,187,205)] disabled:opacity-60 text-white font-semibold shadow-[0_2px_8px_rgba(52,152,169,0.3)] hover:shadow-[0_4px_16px_rgba(52,152,169,0.4)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
            >
              {running ? "Running checks..." : done ? "Run Again" : "Start Check"}
            </button>
            {done && !hasFail && (
              <button
                onClick={() => navigate({ to: "/student/login" })}
                className="flex-1 py-3 px-6 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold shadow transition-all duration-300 cursor-pointer"
              >
                Proceed to Login →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
