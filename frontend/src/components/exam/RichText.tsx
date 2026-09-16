import katex from "katex";
import "katex/dist/katex.min.css";


type Token =
  | { kind: "text"; value: string }
  | { kind: "code"; value: string; lang?: string }
  | { kind: "inlineCode"; value: string }
  | { kind: "math"; value: string; display: boolean };

const PATTERN =
  /```(\w+)?\n?([\s\S]*?)```|\$\$([\s\S]+?)\$\$|`([^`\n]+)`|\$([^$\n]+?)\$/g;

// Content wrapped in $...$/$$...$$ is sometimes just plain text that happens
// to contain literal dollar signs (common in OCR'd or bulk-imported question
// banks) rather than actual LaTeX. Math mode has no concept of spaces or
// words, so feeding it an ordinary sentence produces a wall of mashed-together
// italic letters rather than an error — this heuristic catches that case
// before it ever reaches KaTeX.
function looksLikeMath(inner: string): boolean {
  const s = inner.trim();
  if (!s) return false;
  // Unambiguous LaTeX signals.
  if (/\\[a-zA-Z]/.test(s) || /[\^_]/.test(s)) return true;
  // Three or more ordinary multi-letter words reads like a sentence, not math.
  const wordyTokens = s.split(/\s+/).filter((t) => /^[A-Za-z][A-Za-z'-]+$/.test(t));
  if (wordyTokens.length >= 3) return false;
  return true;
}

export function tokenizeRichText(input: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  PATTERN.lastIndex = 0;
  while ((m = PATTERN.exec(input)) !== null) {
    if (m.index > last) tokens.push({ kind: "text", value: input.slice(last, m.index) });
    if (m[2] !== undefined) tokens.push({ kind: "code", value: m[2].replace(/\n$/, ""), lang: m[1] });
    else if (m[3] !== undefined) {
      if (looksLikeMath(m[3])) tokens.push({ kind: "math", value: m[3], display: true });
      else tokens.push({ kind: "text", value: m[0] });
    } else if (m[4] !== undefined) tokens.push({ kind: "inlineCode", value: m[4] });
    else if (m[5] !== undefined) {
      if (looksLikeMath(m[5])) tokens.push({ kind: "math", value: m[5], display: false });
      else tokens.push({ kind: "text", value: m[0] });
    }
    last = m.index + m[0].length;
  }
  if (last < input.length) tokens.push({ kind: "text", value: input.slice(last) });
  return tokens;
}

function Math({ value, display }: { value: string; display: boolean }) {
  let html = "";
  try {
    html = katex.renderToString(value, { displayMode: display, throwOnError: false });
  } catch {
    return <code style={{ color: "#b91c1c" }}>{value}</code>;
  }
  return display ? (
    <div className="my-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  );
}

interface RichTextProps {
  text?: string;
  className?: string;
}

export function RichText({ text, className }: RichTextProps) {
  if (!text) return null;
  const tokens = tokenizeRichText(text);

  return (
    <span className={className}>
      {tokens.map((t, i) => {
        if (t.kind === "math") return <Math key={i} value={t.value} display={t.display} />;
        if (t.kind === "inlineCode")
          return (
            <code
              key={i}
              className="rounded px-1 py-0.5 font-mono text-[0.9em]"
              style={{ backgroundColor: "#f3f4f6", color: "#111827" }}
            >
              {t.value}
            </code>
          );
        if (t.kind === "code")
          return (
            <pre
              key={i}
              className="my-2 overflow-x-auto rounded-md p-3 font-mono text-xs leading-relaxed"
              style={{ backgroundColor: "#0f172a", color: "#e2e8f0" }}
            >
              <code>{t.value}</code>
            </pre>
          );
        return (
          <span key={i} style={{ whiteSpace: "pre-wrap" }}>
            {t.value}
          </span>
        );
      })}
    </span>
  );
}