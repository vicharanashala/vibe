import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import katex from "katex";
import "katex/dist/katex.min.css";
import qrcode from "@/lib/qrcode";
import { DEMO_EXAM, computeNegativeMarks } from "@/lib/examStore";
import { useAttempt, useExam } from "@/hooks/exam-hooks";
import { useAuthStore } from "@/store/auth-store";
import { RichText, tokenizeRichText } from "@/components/exam/RichText";

// Mirrors ExamProctoring.tsx's ANOMALY_LABELS — kept as a small local copy
// here rather than a shared import since that map is private to the
// detector component; falls back to the raw type string for anything new.
const PROCTORING_EVENT_LABELS = {
  noFace: "No face in frame",
  cameraOff: "Camera turned off",
  multipleFaces: "Multiple faces detected",
  blurDetection: "Camera view is blurry",
  voiceDetection: "Voice detected",
  faceRecognition: "Face doesn't match registered identity",
  cameraIntegrity: "Camera integrity issue",
};

function formatUserAnswer(q, r) {
  if (!r) return "Not Answered";
  if (q.type === "NAT") return (r.natAnswer || "").trim() || "Not Answered";
  const sel = [...(r.selectedOptions || [])].sort();
  if (!sel.length) return "Not Answered";
  return sel
    .map((id) => {
      const opt = (q.options || []).find((o) => o.id === id);
      const label = opt?.label || id;
      return `${label}. ${opt?.text ?? ""}`;
    })
    .join(" | ");
}

function formatCorrectAnswer(q, key) {
  if (!key) return "-";
  if (q.type === "NAT") return String(key.correct);
  const arr = Array.isArray(key.correct) ? [...key.correct].sort() : [key.correct];
  return arr
    .map((id) => {
      const opt = (q.options || []).find((o) => o.id === id);
      const label = opt?.label || id;
      return `${label}. ${opt?.text ?? ""}`;
    })
    .join(" | ");
}

function evaluate(q, r, key) {
  if (!key) return "Not Answered";
  if (q.type === "NAT") {
    const ans = (r?.natAnswer || "").trim();
    if (!ans) return "Not Answered";
    return ans === String(key.correct) ? "Correct" : "Wrong";
  }
  const sel = r?.selectedOptions || [];
  if (!sel.length) return "Not Answered";
  if (q.type === "MCQ") {
    const correct = Array.isArray(key.correct) ? key.correct[0] : key.correct;
    return sel[0] === correct ? "Correct" : "Wrong";
  }
  const a = [...sel].sort().join(",");
  const b = [].concat(key.correct).sort().join(",");
  return a === b ? "Correct" : "Wrong";
}

function recomputeScore(result, exam) {
  let score = 0;
  let correctCount = 0;
  result.questions.forEach((q, i) => {
    const r = result.responses[i];
    const key = result.answers[q.id];
    if (!key) return;
    const neg = computeNegativeMarks(exam, q);
    if (q.type === "MCQ") {
      const correct = Array.isArray(key.correct) ? key.correct[0] : key.correct;
      if (!r?.selectedOptions?.length) return;
      if (r.selectedOptions[0] === correct) {
        score += q.marks;
        correctCount++;
      } else {
        score -= neg;
      }
    } else if (q.type === "MSQ") {
      const sel = [...(r?.selectedOptions || [])].sort().join(",");
      const correct = [].concat(key.correct).sort().join(",");
      if (!sel.length) return;
      if (sel === correct) {
        score += q.marks;
        correctCount++;
      } else {
        score -= neg;
      }
    } else if (q.type === "NAT") {
      const ans = (r?.natAnswer || "").trim();
      if (!ans) return;
      if (ans === String(key.correct)) {
        score += q.marks;
        correctCount++;
      } else {
        score -= neg;
      }
    }
  });
  return { score, correctCount };
}


// Groups questions by `topic` (blank/missing -> "Other") and computes
// per-topic { correctCount, total, marksEarned, marksTotal } from the same
// responses/answers/evaluate machinery the review table and PDF already use.
// Returns null when no question has a topic set, so the caller can skip
// rendering the block entirely rather than showing a single meaningless
// "Other" row.
function computeTopicBreakdown(questions, result, liveExam) {
  const hasAnyTopic = questions.some((q) => (q.topic || "").trim());
  if (!hasAnyTopic) return null;

  const byTopic = new Map();
  questions.forEach((q, i) => {
    const topic = (q.topic || "").trim() || "Other";
    const r = result.responses[i];
    const key = result.answers[q.id];
    const status = evaluate(q, r, key);
    const marksAlloc = Number(q.marks) || 0;
    const neg = computeNegativeMarks(liveExam, q);

    const entry = byTopic.get(topic) || {
      topic,
      correctCount: 0,
      total: 0,
      marksEarned: 0,
      marksTotal: 0,
    };
    entry.total += 1;
    entry.marksTotal += marksAlloc;
    if (status === "Correct") {
      entry.correctCount += 1;
      entry.marksEarned += marksAlloc;
    } else if (status === "Wrong") {
      entry.marksEarned -= neg;
    }
    byTopic.set(topic, entry);
  });

  return Array.from(byTopic.values())
    .map((entry) => ({ ...entry, marksEarned: Math.round(entry.marksEarned * 100) / 100 }))
    .sort((a, b) => a.topic.localeCompare(b.topic));
}

function buildQrPayload(q, r, candidateName) {
  const chosenOptionIds =
    q.type === "NAT"
      ? (r?.natAnswer || "").trim() || "Not Answered"
      : [...(r?.selectedOptions || [])].sort().join(", ") || "Not Answered";

  return JSON.stringify({
    questionId: q.id,
    Candidate_Name: candidateName || "Candidate",
    chosenOptionIds,
  });
}

// Long/garbage-scraped question text shouldn't blow up a table row or a PDF
// page — show a bounded preview everywhere it's displayed to a human.
// jsPDF's doc.text() draws whatever string you give it as literal characters —
// it has no concept of LaTeX or Markdown, so "$$\frac{1}{3}$$" prints exactly
// as those characters. To get real math/code in the PDF, we render the same
// tokens the on-screen <RichText> component uses into an offscreen HTML node,
// rasterize that with html2canvas, and place the resulting image with
// doc.addImage() instead of doc.text().
const RICH_CONTENT_RE = /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|```[\s\S]*?```|`[^`\n]+`/;
function hasRichContent(text) {
  return !!text && RICH_CONTENT_RE.test(text);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function richTextToHtml(text) {
  const tokens = tokenizeRichText(text || "");
  return tokens
    .map((t) => {
      if (t.kind === "math") {
        try {
          return katex.renderToString(t.value, { displayMode: t.display, throwOnError: false });
        } catch {
          return `<code style="color:#b91c1c">${escapeHtml(t.value)}</code>`;
        }
      }
      if (t.kind === "inlineCode") {
        return `<code style="background:#f3f4f6;color:#111827;border-radius:4px;padding:1px 4px;font-family:monospace;font-size:0.9em;">${escapeHtml(
          t.value
        )}</code>`;
      }
      if (t.kind === "code") {
        return `<pre style="background:#0f172a;color:#e2e8f0;border-radius:6px;padding:8px 12px;margin:4px 0;font-family:monospace;font-size:12px;white-space:pre-wrap;">${escapeHtml(
          t.value
        )}</pre>`;
      }
      return `<span style="white-space:pre-wrap;">${escapeHtml(t.value)}</span>`;
    })
    .join("");
}

// jsPDF uses pt units; offscreen HTML uses CSS px. Standard conversion at 96dpi.
const PX_PER_PT = 96 / 72;

async function renderRichTextToImage(text, maxWidthPt, { fontSizePt = 11, color = "#111111" } = {}) {
  const maxWidthPx = Math.max(40, Math.round(maxWidthPt * PX_PER_PT));
  const fontSizePx = fontSizePt * PX_PER_PT;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "0";
  container.style.width = `${maxWidthPx}px`;
  container.style.fontFamily = "Helvetica, Arial, sans-serif";
  container.style.fontSize = `${fontSizePx}px`;
  container.style.lineHeight = "1.35";
  container.style.color = color;
  container.style.background = "#ffffff";
  // A little bottom padding keeps descenders (g, y, ?, etc. on the last
  // line) from being cropped flush against the image's own bottom edge,
  // which otherwise leaves no real breathing room before whatever gets
  // drawn next (e.g. the "Options" header).
  container.style.paddingBottom = "4px";
  // Same idea at the top: KaTeX display-mode content (e.g. \int_0^{\pi/2},
  // \sum, \lim) stacks a superscript/limit ABOVE the main glyph using
  // `position: relative; top: -Npx` internally. That CSS `top` offset moves
  // the glyph purely visually — it does NOT add to the element's own layout
  // height — so a small fixed padding can still be smaller than the actual
  // visual overshoot and get clipped anyway (this is what happened with the
  // earlier 6px value). Scale the padding with font size instead of using a
  // tiny constant, since the overshoot itself scales with font size.
  container.style.paddingTop = `${Math.ceil(fontSizePx * 1.3) + 6}px`;
  // Overflow starts "hidden" (not the default "visible") purely so that
  // scrollWidth below correctly reports the box's true required content
  // width. A KaTeX formula renders as a single non-wrapping unit — if it's
  // wider than maxWidthPx it overflows past the box's right edge. With
  // overflow:visible the box's own rect stays capped at maxWidthPx even
  // though the formula visibly spills out of it, and html2canvas only
  // captures the box's own rect — so that overflow (often HALF the
  // equation) was silently getting cropped out of the PDF image.
  container.style.overflow = "hidden";
  container.innerHTML = richTextToHtml(text);
  document.body.appendChild(container);

  try {
    // KaTeX injects its math glyphs via @font-face fonts. If html2canvas
    // snapshots before those fonts finish downloading, the browser lays out
    // with fallback-font metrics that can differ from the real glyphs —
    // sometimes just enough to change how a line wraps. document.fonts.ready
    // guarantees the actual fonts are in before we measure or capture.
    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // Font loading can reject in some environments; proceed anyway.
      }
    }
    // Let layout settle after any font swap / KaTeX reflow.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    // scrollWidth on an overflow:hidden box correctly reports the full
    // content width even when part of it is clipped from view - this is
    // what lets us detect a formula wider than the column.
    const naturalWidthPx = container.scrollWidth;
    const overflowsWidth = naturalWidthPx > maxWidthPx + 1; // +1 absorbs rounding
    if (overflowsWidth) {
      // Grow the box to fit the content instead of clipping it. We shrink
      // the whole rendered image back down to fit the column once we know
      // its real size (below) - same "measure natural size, then scale to
      // fit" approach used for question/option photos via fitImage().
      container.style.width = `${naturalWidthPx}px`;
    }
    container.style.overflow = "visible";
    // Let layout settle again after the width/overflow change above.
    await new Promise((r) => requestAnimationFrame(r));

    // html2canvas's own pixel height and the DOM's actual rendered height
    // should agree, but occasionally don't (e.g. a glyph's ink extending
    // past its layout box). Cross-checking both and trusting the taller one
    // means we can only ever over-allocate space in the PDF, never
    // under-allocate it — over-allocating just leaves a little extra
    // whitespace; under-allocating is what causes the next element (like
    // the "Options" header) to overlap this image.
    const domRect = container.getBoundingClientRect();
    const domWidthPx = domRect.width;
    const domHeightPx = domRect.height;

    // 1.5x is plenty sharp at print size (~144dpi) — 2x was pushing 4x the pixel
    // count of a 1x render for no visible gain, and it's the biggest single
    // contributor to PDF size when a paper has many math/code questions.
    const RENDER_SCALE = 1.5;
    const canvas = await html2canvas(container, { backgroundColor: "#ffffff", scale: RENDER_SCALE, logging: false });
    // JPEG compresses these rasterized text/math blocks far better than PNG
    // (which stores every anti-aliased edge losslessly). Quality 0.85 is
    // visually indistinguishable from the PNG at print size but a fraction
    // of the bytes. Needs an opaque background since JPEG has no alpha.
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

    const canvasWidthPx = canvas.width / RENDER_SCALE;
    const canvasHeightPx = canvas.height / RENDER_SCALE;
    const widthPx = Math.max(canvasWidthPx, domWidthPx);
    const heightPx = Math.max(canvasHeightPx, domHeightPx);

    let widthPt = widthPx / PX_PER_PT;
    let heightPt = heightPx / PX_PER_PT + 2; // +2pt safety margin against rounding

    // If the true content came out wider than the column (the overflow
    // case above), scale width AND height down together so the equation
    // ends up complete-but-smaller instead of full-size-but-cropped.
    if (widthPt > maxWidthPt) {
      const shrink = maxWidthPt / widthPt;
      widthPt *= shrink;
      heightPt *= shrink;
    }

    return { dataUrl, widthPt, heightPt };
  } finally {
    document.body.removeChild(container);
  }
}

function truncateText(text, maxLen = 220) {
  if (!text) return "";
  const trimmed = String(text).trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen).trimEnd() + "…" : trimmed;
}

// Verification hash for the generated PDF (candidate + score + timestamp),
// so a printed/exported response sheet can be checked against tampering.
async function generatePdfHash(data) {
  try {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (e) {
    console.error("Hash generation failed", e);
    return null;
  }
}

// Offline QR -> PNG data URL (no npm package / internet needed)
function makeQrDataUrl(text, targetPx = 160) {
  try {
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const qr = qrcode(0, "M");
    qr.addData(bin, "Byte");
    qr.make();
    const count = qr.getModuleCount();
    const margin = 2;
    const cell = Math.max(2, Math.floor(targetPx / (count + margin * 2)));
    const size = (count + margin * 2) * cell;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#000000";
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect((col + margin) * cell, (row + margin) * cell, cell, cell);
        }
      }
    }
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.error("QR generation failed", e);
    return null;
  }
}

// If the result payload had its images stripped at submit time (see
// stripImages() in ExamPage.jsx, used when the full payload was too big for
// localStorage), pull them back in from the live exam so the table and PDF
// still show them for as long as the exam itself still exists. Question
// images match by question id. Option images can't match by id, because
// each attempt shuffles options and reassigns ids to A/B/C/D - they match by
// option text instead, which is preserved verbatim through the shuffle.
function hydrateQuestionImages(questions, liveExam) {
  if (!liveExam?.questions?.length) return questions;
  const liveById = new Map(liveExam.questions.map((q) => [q.id, q]));
  return questions.map((q) => {
    const liveQ = liveById.get(q.id);
    if (!liveQ) return q;
    const questionImage = q.questionImage ?? liveQ.questionImage;
    const options = (q.options || []).map((opt) => {
      if (opt.image || !liveQ.options?.length) return opt;
      const liveOpt = liveQ.options.find((lo) => lo.text === opt.text);
      return liveOpt?.image ? { ...opt, image: liveOpt.image } : opt;
    });
    return { ...q, questionImage, options };
  });
}

export default function ResultPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  // Only true when this ResultPage is running inside the popup opened by
  // openExamWindow() — not when viewed from MyTestsPage or Admin Preview.
  const isPopup = typeof window !== "undefined" && !!window.opener && !window.opener.closed;
  const [autoCloseSeconds, setAutoCloseSeconds] = useState(isPopup ? 60 : null);
  const [autoCloseCancelled, setAutoCloseCancelled] = useState(false);

  // Lightbox for a proctoring evidence thumbnail — holds the clicked event
  // (type/at/imageDataUrl) or null when closed. Simple click-to-enlarge, no
  // gallery/modal library.
  const [lightboxEvent, setLightboxEvent] = useState(null);

  const closeNow = () => (isPopup ? window.close() : navigate("/"));

  useEffect(() => {
    if (!isPopup || autoCloseCancelled || autoCloseSeconds === null) return;
    if (autoCloseSeconds <= 0) {
      window.close();
      return;
    }
    const t = setTimeout(() => setAutoCloseSeconds((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [autoCloseSeconds, autoCloseCancelled, isPopup]);

  // The demo exam's attempts are 100% local (see ExamPage.jsx, which tags
  // them with a `local-` prefixed id) so they can be read straight out of
  // localStorage with no backend involvement. Anything else is a real Mongo
  // attempt id, fetched from the API.
  const isDemoAttempt = !!attemptId && attemptId.startsWith("local-");

  const [demoResult, setDemoResult] = useState(null);
  useEffect(() => {
    if (!isDemoAttempt) return;
    try {
      const raw = localStorage.getItem(`result_${attemptId}`);
      if (raw) setDemoResult(JSON.parse(raw));
    } catch (e) {
      console.error("Failed to parse result", e);
    }
  }, [attemptId, isDemoAttempt]);

  const {
    data: apiAttempt,
    refetch: refetchAttempt,
  } = useAttempt(isDemoAttempt ? undefined : attemptId);

  const rawResult = isDemoAttempt ? demoResult : apiAttempt;

  // API attempt responses are keyed by questionId (map lookup), not array
  // index — normalize them into the same `{ question, selectedOptions,
  // natAnswer }` shape (index-aligned with `questions`) the rest of this
  // page (recomputeScore, formatUserAnswer, the PDF export, …) already
  // expects from the demo/local-attempt shape.
  const result = useMemo(() => {
    if (!rawResult) return null;
    if (isDemoAttempt) return rawResult;
    const byQid = new Map((rawResult.responses || []).map((r) => [r.questionId, r]));
    const responses = (rawResult.questions || []).map((q) => {
      const r = byQid.get(q.id);
      return {
        question: q.id,
        selectedOptions: r?.selectedOptionIds || [],
        natAnswer: r?.natValue ?? "",
        isMarkedForReview: !!r?.isMarkedForReview,
        isAnswered: !!(r?.selectedOptionIds?.length || (r?.natValue ?? "").length),
        visited: true,
        timeSpent: 0,
      };
    });
    return { ...rawResult, responses };
  }, [rawResult, isDemoAttempt]);

  const liveExamId = !isDemoAttempt && result?.examId ? result.examId : undefined;
  const { data: fetchedLiveExam, refetch: refetchLiveExam } = useExam(liveExamId);
  const liveExam = isDemoAttempt ? DEMO_EXAM : fetchedLiveExam ?? null;

  // Admin may have toggled reveal-answers (or edited the exam) since this
  // attempt was taken — refetch on refocus so a result tab left open picks
  // that up, same intent as the old exam_store_updated/focus listeners.
  useEffect(() => {
    if (isDemoAttempt) return;
    const onFocus = () => {
      refetchAttempt();
      refetchLiveExam();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [isDemoAttempt, refetchAttempt, refetchLiveExam]);

  if (!result) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <p className="text-lg">No result found for this attempt.</p>
          <Link to="/" className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  // Prefer the live exam's current setting (admin may have toggled it since
  // the attempt), but fall back to the value captured on the result itself
  // when the exam is missing/deleted - otherwise a previously-revealed
  // result would silently flip to "hidden" just because its exam no longer
  // exists.
  const reveal = liveExam ? !!liveExam.revealAnswers : !!result.revealAnswers;

  const { score: liveScore, correctCount: liveCorrect } = recomputeScore(result, liveExam);

  // Re-attach any images that got stripped from the saved payload (see
  // hydrateQuestionImages above). Order and length match result.questions
  // exactly, so result.responses[i] stays aligned to hydratedQuestions[i].
  const hydratedQuestions = hydrateQuestionImages(result.questions, liveExam);

  // Map each question id to its position in the ORIGINAL exam order (not the
  // shuffled per-attempt order), so "Q.N" is consistent across attempts.
  const originalOrderMap = new Map(
    (liveExam?.questions || []).map((q, idx) => [q.id, idx + 1])
  );
  const questionNumber = (q, fallbackIndex) =>
    originalOrderMap.get(q.id) ?? fallbackIndex + 1;

  // Questions paired with their responses, re-sorted into original exam order
  // so numbering AND display order stay consistent across attempts.
  const orderedEntries = hydratedQuestions
    .map((q, i) => ({ q, r: result.responses[i], num: questionNumber(q, i) }))
    .sort((a, b) => a.num - b.num);

  const wrongCount = hydratedQuestions.filter(
    (q, i) => evaluate(q, result.responses[i], result.answers[q.id]) === "Wrong"
  ).length;

  const unattemptedCount = hydratedQuestions.filter(
    (q, i) => evaluate(q, result.responses[i], result.answers[q.id]) === "Not Answered"
  ).length;

  // Only meaningful once correctness is actually visible to the student —
  // same gate as the Correct/Status columns in the review table below.
  const topicBreakdown = reveal ? computeTopicBreakdown(hydratedQuestions, result, liveExam) : null;

  const measureImage = (dataUrl) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = dataUrl;
    });

  const imgFormat = (dataUrl) => (dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG");

  // Question/option images now come back from the API as real (signed) GCS
  // URLs, not embedded base64 — but jsPDF's addImage() only accepts a base64
  // string (or an Image/Canvas element), not a fetchable URL. This fetches
  // and re-encodes any non-`data:` src before it's ever handed to addImage;
  // a `data:` src (the demo exam, or any pre-migration attempt that still has
  // an old embedded image) passes through untouched, no network round-trip.
  // Requires the storage bucket to allow cross-origin fetches for the
  // frontend's origin — if that's ever missing, this fails closed (returns
  // null) and the image is silently skipped from the PDF rather than
  // breaking the whole export.
  const toDataUrl = async (src) => {
    if (!src) return null;
    if (src.startsWith("data:")) return src;
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn("Could not fetch image for PDF export:", e);
      return null;
    }
  };

  const downloadPDF = async () => {
    try {
      const liveReveal = reveal;
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginX = 36;
      const contentWidth = pageWidth - marginX * 2;
      let y = 0;

      const candidateId = String(attemptId || "ATTEMPT").toUpperCase();
      const candidateName = isAuthenticated && user ? (user.name || user.email || "Candidate") : "Candidate";

      // Pre-generate one QR per question: question + candidate + chosen option
      const qrDataUrls = new Map();
      for (let i = 0; i < hydratedQuestions.length; i++) {
        const q = hydratedQuestions[i];
        const r = result.responses[i];
        const dataUrl = makeQrDataUrl(buildQrPayload(q, r, candidateName), 160);
        if (dataUrl) qrDataUrls.set(q.id, dataUrl);
      }

      const imgDims = new Map();
      // Resolved (guaranteed base64) source for each image, keyed by the
      // original src — see toDataUrl() above. addImage() calls below must
      // use this map's value, never the raw q.questionImage/opt.image string.
      const imgDataUrls = new Map();
      for (const q of hydratedQuestions) {
        if (q.questionImage && !imgDims.has(q.questionImage)) {
          imgDims.set(q.questionImage, await measureImage(q.questionImage));
          imgDataUrls.set(q.questionImage, await toDataUrl(q.questionImage));
        }
        for (const opt of q.options || []) {
          if (opt.image && !imgDims.has(opt.image)) {
            imgDims.set(opt.image, await measureImage(opt.image));
            imgDataUrls.set(opt.image, await toDataUrl(opt.image));
          }
        }
      }

      const drawWatermark = () => {
        let restoreOpacity = null;
        try {
          if (typeof doc.setGState === "function" && typeof doc.GState === "function") {
            doc.saveGraphicsState();
            doc.setGState(new doc.GState({ opacity: 0.07 }));
            restoreOpacity = true;
          }
        } catch {
          restoreOpacity = null;
        }

        doc.setTextColor(restoreOpacity ? 60 : 225, restoreOpacity ? 60 : 225, restoreOpacity ? 60 : 225);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(13);

        const textW = doc.getTextWidth(candidateId);
        const stepX = textW + 70; // enough gap so rotated copies never overlap
        const stepY = 110;

        for (let wy = 60; wy < pageHeight + stepY; wy += stepY) {
          for (let wx = -textW; wx < pageWidth + textW; wx += stepX) {
            doc.text(candidateId, wx, wy, { angle: 30 });
          }
        }

        if (restoreOpacity) {
          try {
            doc.restoreGraphicsState();
          } catch {}
        }
        doc.setTextColor(0, 0, 0);
      };

      const drawHeader = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.setTextColor(17, 17, 17);
        doc.text(
          `TEST Result: ${result.examTitle || "ViBe Test Platform"}`,
          pageWidth / 2,
          40,
          { align: "center" }
        );
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(85, 85, 85);
        const scoreLine = liveReveal
          ? `Candidate: ${candidateName}   |   Score: ${liveScore} / ${result.totalMarks}`
          : `Candidate: ${candidateName}   |   Score: Hidden`;
        doc.text(scoreLine, pageWidth / 2, 58, { align: "center" });
        doc.setDrawColor(220, 220, 220);
        doc.line(marginX, 68, pageWidth - marginX, 68);
        doc.setTextColor(0, 0, 0);
      };

      const newPage = (first = false) => {
        if (!first) doc.addPage();
        drawWatermark();
        drawHeader();
        y = 88;
      };

      const ensureSpace = (needed) => {
        if (y + needed > pageHeight - 40) newPage();
      };

      const metaBoxW = 240;
      const metaBoxRightMargin = 12;
      const metaX = pageWidth - marginX - metaBoxRightMargin - metaBoxW;
      // Images in the left column must never extend into the meta box's
      // horizontal space, since the meta box is pinned to the top-right of
      // the card regardless of how tall the question text/image is.
      const leftColumnMaxW = metaX - (marginX + 12) - 20;

      const fitImage = (dataUrl, maxW, maxH) => {
        const dim = imgDims.get(dataUrl) || { w: 0, h: 0 };
        if (!dim.w || !dim.h) return { w: 0, h: 0 };
        const scale = Math.min(maxW / dim.w, maxH / dim.h, 1);
        return { w: dim.w * scale, h: dim.h * scale };
      };

      const qWrapWidth = Math.max(80, leftColumnMaxW - 30);
      const optWrapWidth = Math.max(80, leftColumnMaxW - 12);

      // Pre-render any question/option text containing LaTeX or code into an
      // image (same pre-measure-then-draw pattern as imgDims above), so the
      // layout pass below can just look up a size instead of awaiting mid-loop.
      const richImages = new Map();
      const richKey = (text, wrapWidth) => `${wrapWidth}::${text}`;
      for (const q of hydratedQuestions) {
        const qText = truncateText(q.questionText, 700);
        if (hasRichContent(qText)) {
          const key = richKey(qText, qWrapWidth);
          if (!richImages.has(key)) {
            richImages.set(key, await renderRichTextToImage(qText, qWrapWidth, { fontSizePt: 11 }));
          }
        }
        for (let optIdx = 0; optIdx < (q.options || []).length; optIdx++) {
          const opt = q.options[optIdx];
          const letter = opt.label || String.fromCharCode(65 + optIdx);
          const labelStr = `${letter}.  ${opt.text || ""}`.trim();
          if (hasRichContent(labelStr)) {
            const key = richKey(labelStr, optWrapWidth);
            if (!richImages.has(key)) {
              richImages.set(key, await renderRichTextToImage(labelStr, optWrapWidth, { fontSizePt: 10 }));
            }
          }
        }
      }

      newPage(true);

      orderedEntries.forEach(({ q, r, num }) => {
  const key = result.answers[q.id];
  const status = evaluate(q, r, key);
  const marksAlloc = q.marks ?? 1;
  const negAlloc = computeNegativeMarks(liveExam, q);

  // Bound question text so one absurdly long/scraped question can't blow a
  // card taller than a page (which forces an empty leading page) or run its
  // text underneath the meta/QR column.
  const questionTextForPdf = truncateText(q.questionText, 700);
  const qWrapWidth = Math.max(80, leftColumnMaxW - 30);
  const optWrapWidth = Math.max(80, leftColumnMaxW - 12);

  // 1. Calculate approximate height of this question card beforehand
  const qRichImg = richImages.get(richKey(questionTextForPdf, qWrapWidth));
  let questionTextH = 14;
  if (qRichImg) {
    questionTextH = qRichImg.heightPt;
  } else if (questionTextForPdf) {
    // Must match the font size used when this text is actually drawn further
    // below (11pt) — splitTextToSize measures using the doc's *current* font
    // size, so without this the leftover size from a previous question could
    // cause this pass to wrap to fewer lines than the real draw pass does,
    // making later elements (like the "Options" header) overlap this text.
    doc.setFontSize(11);
    const qLines = doc.splitTextToSize(questionTextForPdf, qWrapWidth);
    questionTextH = qLines.length * 14;
  }
  let qImgH = 0;
  if (q.questionImage) {
    const { h } = fitImage(q.questionImage, leftColumnMaxW, 260);
    qImgH = h ? h + 8 : 0;
  }

  let optionsH = 0;
  if (q.type !== "NAT" && q.options?.length) {
    optionsH += 18;
    q.options.forEach((opt, optIdx) => {
      const letter = opt.label || String.fromCharCode(65 + optIdx);
      const labelStr = `${letter}.  ${opt.text || ""}`.trim();
      const optRichImg = richImages.get(richKey(labelStr, optWrapWidth));
      if (optRichImg) {
        optionsH += optRichImg.heightPt + 6;
      } else {
        doc.setFontSize(10);
        const optLines = doc.splitTextToSize(labelStr, optWrapWidth);
        optionsH += optLines.length * 13 + 4;
      }
      if (opt.image) {
        const { h } = fitImage(opt.image, leftColumnMaxW - 12, 110);
        if (h) optionsH += h + 6;
      }
    });
  }

  const idToLabel = (id) => {
    const optIdx = (q.options || []).findIndex((o) => o.id === id);
    const opt = q.options[optIdx];
    return opt?.label || (optIdx >= 0 ? String.fromCharCode(65 + optIdx) : id);
  };

  const chosen =
    q.type === "NAT"
      ? (r?.natAnswer || "").trim() || "--"
      : [...(r?.selectedOptions || [])]
          .map(idToLabel)
          .sort()
          .join(", ") || "--";

  const correctVal =
    q.type === "NAT"
      ? String(key?.correct ?? "")
      : (Array.isArray(key?.correct) ? [...key.correct] : [key?.correct])
          .map(idToLabel)
          .sort()
          .join(", ");

  const isCorrect = status === "Correct";
  const marksObtained =
    status === "Not Answered" ? "0" : isCorrect ? `+${marksAlloc}` : negAlloc > 0 ? `-${negAlloc}` : "0";
  const markColor = isCorrect
    ? [22, 163, 74]
    : status === "Wrong"
    ? [220, 38, 38]
    : [17, 17, 17];

  const metaRows = [
    ["Question Type :", q.type],
    ["Question ID :", q.id],
    ["Status :", status === "Not Answered" ? "Not Answered" : "Answered"],
    ["Chosen Option :", chosen],
  ];
  if (liveReveal) {
    metaRows.push(["Correct Option :", correctVal || "-", [22, 163, 74]]);
    metaRows.push(["Marks :", marksObtained, markColor]);
  }

  let computedMetaH = 14;
  doc.setFontSize(10);
  metaRows.forEach(([_, value]) => {
    const valLines = doc.splitTextToSize(String(value), metaBoxW / 2 - 10);
    computedMetaH += valLines.length * 12 + 6;
  });
  const metaBoxH = computedMetaH;

  const qrCodeSize = qrDataUrls.has(q.id) ? 84 + 10 + 12 + 8 : 0;
  const rightSideH = metaBoxH + qrCodeSize + 12;
  const leftSideH = 25 + questionTextH + 10 + qImgH + optionsH + 20;
  const totalCardH = Math.max(leftSideH, rightSideH) + 20;

  // 2. Safely push to a new page BEFORE drawing if it won't fit
  ensureSpace(totalCardH + 30);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(136, 136, 136);

  y += 10;

  const cardTop = y;
  const leftPad = marginX + 12;
  let innerY = cardTop + 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(17, 17, 17);
  doc.text(`Q.${num}`, leftPad, innerY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  if (qRichImg) {
    try {
      doc.addImage(qRichImg.dataUrl, "JPEG", leftPad + 28, innerY, qRichImg.widthPt, qRichImg.heightPt);
      innerY += qRichImg.heightPt + 10;
    } catch {
      // addImage failed but we still know how tall this block was supposed
      // to be — advance by that, not a guessed flat amount, so later
      // elements (like "Options") don't overlap whatever partial content
      // did get drawn.
      innerY += qRichImg.heightPt + 10;
    }
  } else if (questionTextForPdf) {
    const qLines = doc.splitTextToSize(questionTextForPdf, qWrapWidth);
    doc.text(qLines, leftPad + 28, innerY);
    innerY += qLines.length * 14 + 6;
  } else {
    innerY += 14;
  }

  if (q.questionImage) {
    const { w, h } = fitImage(q.questionImage, leftColumnMaxW, 260);
    const resolvedSrc = imgDataUrls.get(q.questionImage);
    if (w && h && resolvedSrc) {
      try {
        doc.addImage(resolvedSrc, imgFormat(resolvedSrc), leftPad, innerY, w, h);
        innerY += h + 8;
      } catch {}
    }
  }

  // 3. Render Options with dynamic A, B, C, D labels
  if (q.type !== "NAT" && q.options?.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Options", leftPad, innerY);
    innerY += 14;
    doc.setFont("helvetica", "normal");
    q.options.forEach((opt, optIdx) => {
      const letter = opt.label || String.fromCharCode(65 + optIdx);
      const labelStr = `${letter}.  ${opt.text || ""}`.trim();
      const optRichImg = richImages.get(richKey(labelStr, optWrapWidth));
      if (optRichImg) {
        try {
          doc.addImage(optRichImg.dataUrl, "JPEG", leftPad + 12, innerY, optRichImg.widthPt, optRichImg.heightPt);
          innerY += optRichImg.heightPt + 6;
        } catch {
          innerY += optRichImg.heightPt + 6;
        }
      } else {
        const optLines = doc.splitTextToSize(labelStr, optWrapWidth);
        doc.text(optLines, leftPad + 12, innerY);
        innerY += optLines.length * 13 + 4;
      }
      if (opt.image) {
        const { w, h } = fitImage(opt.image, leftColumnMaxW - 12, 110);
        const resolvedOptSrc = imgDataUrls.get(opt.image);
        if (w && h && resolvedOptSrc) {
          try {
            doc.addImage(resolvedOptSrc, imgFormat(resolvedOptSrc), leftPad + 24, innerY, w, h);
            innerY += h + 6;
          } catch {}
        }
      }
    });
  }

  // metaX already computed once, outside this loop
  const metaY = cardTop + 18;

  const qrSize = 84;
  const qrGap = 10;
  const qrLabelH = 12;
  const qrDataUrl = qrDataUrls.get(q.id);
  const cardBottomComputed = qrDataUrl
    ? metaY + metaBoxH + 12 + qrGap + qrSize + qrLabelH + 8
    : metaY + metaBoxH + 12;

  const cardBottom = Math.max(innerY + 10, cardBottomComputed);

  doc.setDrawColor(170, 170, 170);
  doc.setLineWidth(1.2);
  doc.rect(marginX, cardTop, contentWidth, cardBottom - cardTop);

  doc.setDrawColor(153, 153, 153);
  doc.setLineWidth(1);
  doc.roundedRect(metaX, metaY, metaBoxW, metaBoxH, 6, 6);

  doc.setFontSize(10);
  let mY = metaY + 18;
  metaRows.forEach(([label, value, color]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60, 60, 60);
    doc.text(label, metaX + metaBoxW / 2 - 6, mY, { align: "right" });

    doc.setFont("helvetica", "bold");
    if (color) doc.setTextColor(color[0], color[1], color[2]);
    else doc.setTextColor(17, 17, 17);

    const valLines = doc.splitTextToSize(String(value), metaBoxW / 2 - 10);
    doc.text(valLines, metaX + metaBoxW / 2, mY);

    mY += (valLines.length * 12) + 6;
  });
  doc.setTextColor(0, 0, 0);

  if (qrDataUrl) {
    const qrX = metaX + (metaBoxW - qrSize) / 2;
    const qrY = metaY + metaBoxH + 12 + qrGap;
    try {
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
    } catch {}
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Scan for question & response", qrX + qrSize / 2, qrY + qrSize + 10, {
      align: "center",
    });
    doc.setTextColor(0, 0, 0);
  }

  y = cardBottom + 18;
});

      const generatedAt = new Date();
      const generatedAtStr = generatedAt.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
      });
      const hashInput = `${candidateId}|${result.examId || ""}|${attemptId || ""}|${liveScore}|${generatedAt.toISOString()}`;
      const fullHash = await generatePdfHash(hashInput);
      const shortHash = fullHash ? fullHash.slice(0, 16).toUpperCase() : "N/A";

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(160, 160, 160);
        doc.text(
          `Generated: ${generatedAtStr}   |   Verification Hash: ${shortHash}`,
          pageWidth / 2,
          pageHeight - 20,
          { align: "center" }
        );
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - marginX, pageHeight - 20, {
          align: "right",
        });
      }

      doc.save(`Mock_Result_${candidateId}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Check console for details.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {isPopup && !autoCloseCancelled && autoCloseSeconds !== null && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3 text-sm text-amber-900">
            <span>
              Test submitted. This window will close automatically in <strong>{autoCloseSeconds}s</strong>.
            </span>
            <div className="flex gap-2">
              <button onClick={closeNow} className="px-3 py-1.5 rounded-md bg-amber-600 text-white font-medium hover:bg-amber-700">
                Close Now
              </button>
              <button onClick={() => setAutoCloseCancelled(true)} className="px-3 py-1.5 rounded-md border border-amber-400 hover:bg-amber-100">
                Keep Reviewing
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Your Result</h1>
            {result.proctoringEvents?.length > 0 && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                Proctoring: {result.proctoringEvents.length} flag{result.proctoringEvents.length === 1 ? '' : 's'}
              </span>
            )}
            {result.tabSwitches > 0 && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
                {result.tabSwitches} tab switch{result.tabSwitches === 1 ? '' : 'es'}
              </span>
            )}
          </div>
          <button
            onClick={downloadPDF}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90"
          >
            Download Response Sheet (PDF)
          </button>
        </div>

        {/* Proctoring evidence thumbnails — only the events that actually
            captured a snapshot (the serious/blocking anomaly types; softer
            signals like blurDetection/cameraIntegrity are logged with no
            image). Click a thumbnail to view it larger in a simple lightbox. */}
        {result.proctoringEvents?.some((e) => e.imageDataUrl) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
              Proctoring evidence snapshots
            </p>
            <div className="flex flex-wrap gap-3">
              {result.proctoringEvents
                .filter((e) => e.imageDataUrl)
                .map((e, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setLightboxEvent(e)}
                    className="flex w-24 flex-col items-center gap-1 rounded-md border border-amber-300 bg-white p-1.5 text-left hover:border-amber-500"
                  >
                    <img
                      src={e.imageDataUrl}
                      alt={PROCTORING_EVENT_LABELS[e.type] || e.type}
                      className="h-16 w-full rounded object-cover"
                    />
                    <span className="w-full truncate text-[10px] font-medium text-amber-900">
                      {PROCTORING_EVENT_LABELS[e.type] || e.type}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {e.at ? new Date(e.at).toLocaleTimeString() : ""}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Lightbox: enlarged view of a clicked evidence thumbnail. Click the
            backdrop or the close button to dismiss. */}
        {lightboxEvent && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
            onClick={() => setLightboxEvent(null)}
          >
            <div
              className="max-w-lg rounded-lg bg-white p-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-foreground">
                  {PROCTORING_EVENT_LABELS[lightboxEvent.type] || lightboxEvent.type}
                  {lightboxEvent.at ? ` · ${new Date(lightboxEvent.at).toLocaleString()}` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxEvent(null)}
                  className="rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <img
                src={lightboxEvent.imageDataUrl}
                alt={PROCTORING_EVENT_LABELS[lightboxEvent.type] || lightboxEvent.type}
                className="max-h-[70vh] w-full rounded object-contain"
              />
            </div>
          </div>
        )}

        {reveal ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Score</p>
              <p className="text-2xl font-bold text-primary">
                {liveScore} / {result.totalMarks}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Correct</p>
              <p className="text-2xl font-bold text-emerald-500">
                {liveCorrect} / {result.total}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Wrong</p>
              <p className="text-2xl font-bold text-destructive">{wrongCount}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">Unattempted</p>
              <p className="text-2xl font-bold">{unattemptedCount}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Correct answers are hidden by the admin. You can still download your response sheet.
          </div>
        )}

        {topicBreakdown && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Score by topic</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="py-1 pr-4">Topic</th>
                    <th className="py-1 pr-4">Correct</th>
                    <th className="py-1 pr-4">Marks</th>
                  </tr>
                </thead>
                <tbody>
                  {topicBreakdown.map((t) => (
                    <tr key={t.topic} className="border-t border-border/60">
                      <td className="py-1.5 pr-4 font-medium">{t.topic}</td>
                      <td className="py-1.5 pr-4">
                        {t.correctCount}/{t.total} correct
                      </td>
                      <td className="py-1.5 pr-4">
                        {t.marksEarned}/{t.marksTotal} marks
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="p-3">Q.No</th>
                <th className="p-3">Question</th>
                <th className="p-3">Your Answer</th>
                {reveal && <th className="p-3">Correct</th>}
                {reveal && <th className="p-3">Status</th>}
              </tr>
            </thead>
            <tbody>
              {orderedEntries.map(({ q, r, num }) => {
                const key = result.answers[q.id];
                const status = evaluate(q, r, key);
                const color =
                  status === "Correct"
                    ? "text-emerald-500"
                    : status === "Wrong"
                    ? "text-destructive"
                    : "text-muted-foreground";
                return (
                  <Fragment key={q.id}>
                    <tr className="border-t border-border align-top">
                      <td className="p-3 font-medium">{num}</td>
                      <td className="p-3 max-w-md">
                        <RichText text={truncateText(q.questionText, 220)} />
                        {q.questionImage && (
                          <img
                            src={q.questionImage}
                            alt=""
                            className="mt-2 max-h-40 max-w-[220px] rounded border border-border object-contain"
                          />
                        )}
                      </td>
                      <td className="p-3">{formatUserAnswer(q, r)}</td>
                      {reveal && <td className="p-3">{formatCorrectAnswer(q, key)}</td>}
                      {reveal && <td className={`p-3 font-medium ${color}`}>{status}</td>}
                    </tr>
                    {reveal && q.explanation && (
                      <tr className="border-t border-dashed border-border/60 bg-muted/20">
                        <td className="p-3" />
                        <td className="p-3 text-xs text-muted-foreground" colSpan={4}>
                          <span className="font-medium text-foreground">Explanation: </span>
                          <RichText text={q.explanation} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {isPopup ? (
          <button
            onClick={closeNow}
            className="inline-block px-4 py-2 rounded-md border border-border hover:bg-muted"
          >
            Close Window
          </button>
        ) : (
          <Link
            to="/"
            className="inline-block px-4 py-2 rounded-md border border-border hover:bg-muted"
          >
            Back to home
          </Link>
        )}
      </div>
    </div>
  );
}
