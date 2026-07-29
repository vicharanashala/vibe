import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/**
 * Premium, mentor-toned guidance shown below the camera preview while the
 * session initializes (~15s). A pool of short messages is shuffled on each
 * mount (reload), and a small random subset is shown — each held 3.5–5s with
 * subtle slide-up + fade transitions. Accent is conveyed through brightness /
 * weight (not colour) to stay calm and on-theme.
 */
type PrepMessage = { text: string; highlight?: string };

const POOL: PrepMessage[] = [
  { text: "Take a moment to settle in and prepare to learn.", highlight: "settle in" },
  { text: "Learning begins when attention meets curiosity.", highlight: "attention" },
  { text: "Stay present — every interaction strengthens understanding.", highlight: "Stay present" },
  { text: "Focus on the lesson, not just completing it.", highlight: "Focus" },
  { text: "Understanding grows through engagement, not passive watching.", highlight: "engagement" },
  { text: "Great learning starts with full attention.", highlight: "full attention" },
  { text: "Active participation improves retention.", highlight: "Active participation" },
  { text: "Keep ViBe in focus for the best learning experience.", highlight: "focus" },
  {
    text: "Follow the 20-20-20 rule: every 20 minutes, look 20 feet away for 20 seconds.",
    highlight: "20-20-20 rule",
  },
  { text: "Sit comfortably, breathe, and let your focus settle.", highlight: "breathe" },
  { text: "Curiosity turns information into understanding.", highlight: "Curiosity" },
  { text: "Small, consistent effort compounds into mastery.", highlight: "consistent effort" },
  { text: "Distraction fades when intention leads.", highlight: "intention" },
  { text: "Engage with the material — ask, pause, reflect.", highlight: "ask, pause, reflect" },
  { text: "Quality of attention matters more than hours spent.", highlight: "Quality of attention" },
  { text: "Give this lesson your presence, not just your time.", highlight: "presence" },
  { text: "Learning is a practice — show up fully.", highlight: "show up fully" },
  { text: "Protect your focus; silence what can wait.", highlight: "Protect your focus" },
];

// How many of the pooled messages to show per session (the rest of the 15s
// window naturally caps how many are actually seen).
const SESSION_COUNT = 5;

// Fisher–Yates shuffle (Math.random is fine in a component; runs once per mount).
function pickSession(): PrepMessage[] {
  const arr = [...POOL];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, SESSION_COUNT);
}

// Hold each message 3.5–5s, scaled gently by length so longer lines linger.
const holdFor = (text: string) => Math.min(5000, Math.max(3500, text.length * 55));

function Highlighted({ text, highlight }: PrepMessage) {
  if (!highlight) return <>{text}</>;
  const i = text.toLowerCase().indexOf(highlight.toLowerCase());
  if (i === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="font-medium text-stage-foreground">{text.slice(i, i + highlight.length)}</span>
      {text.slice(i + highlight.length)}
    </>
  );
}

export function LearnPrepMessages() {
  // Shuffled once per mount → a different random set each reload.
  const [messages] = useState(pickSession);
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    const t = setTimeout(
      () => setIndex((i) => (i + 1) % messages.length),
      holdFor(messages[index].text),
    );
    return () => clearTimeout(t);
  }, [index, messages]);

  const message = messages[index];

  return (
    <div className="flex w-full max-w-xs flex-col items-center gap-2.5 sm:max-w-sm">
      {/* Reserve height so the layout never jumps between messages */}
      <div className="flex min-h-11 items-center justify-center px-2">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-balance text-center text-[13px] leading-relaxed text-stage-foreground/55 sm:text-sm"
          >
            <Highlighted {...message} />
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Subtle step indicator */}
      <div className="flex items-center gap-1.5" aria-hidden>
        {messages.map((_, i) => (
          <span
            key={i}
            className={`h-1 rounded-full transition-all duration-500 ease-out ${
              i === index ? "w-4 bg-stage-foreground/60" : "w-1 bg-stage-foreground/20"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default LearnPrepMessages;
