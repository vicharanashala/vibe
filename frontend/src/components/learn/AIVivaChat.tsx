import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/utils/utils';
import {
  Send, RotateCcw, Bot, User, Loader2,
  Trophy, AlertCircle, CheckCircle2, Star, ExternalLink,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type VivaGrade = 'Excellent' | 'Very Good' | 'Good' | 'Average' | 'Fail';

interface Message {
  role: 'assistant' | 'user';
  content: string;
}

/** A project item assigned in the course (external submission — Google Colab, GitHub, etc.) */
export interface VivaProjectContext {
  projectId: string;
  projectName: string;
  projectDescription: string;
  /** URL the student submitted (Google Colab, GitHub, Drive, etc.) — may be empty if not yet submitted */
  submittedUrl?: string;
  /** Optional comment the student left on submission */
  submittedComment?: string;
}

export interface AIVivaChatProps {
  /** All item IDs in the course — used to read playground code from localStorage */
  courseItemIds: string[];
  courseName: string;
  /** External projects assigned in this course (teacher-created PROJECT items) */
  projects?: VivaProjectContext[];
  onComplete?: (grade: VivaGrade) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const LANG_IDS = ['python', 'javascript', 'typescript', 'java', 'cpp', 'c', 'html', 'css', 'json', 'mongodb'] as const;

function readPlaygroundCode(itemIds: string[]): string {
  const snippets: string[] = [];
  for (const itemId of itemIds) {
    for (const lang of LANG_IDS) {
      const code = localStorage.getItem(`vibe-pg-${itemId}-${lang}`);
      if (code?.trim()) {
        snippets.push(`[${lang.toUpperCase()} — item: ${itemId}]\n${code.trim()}`);
      }
    }
  }
  return snippets.length > 0 ? snippets.join('\n\n---\n\n') : '';
}

const GRADE_CONFIG: Record<VivaGrade, { color: string; icon: React.ReactNode; label: string }> = {
  Excellent:   { color: 'bg-emerald-500', icon: <Trophy className="h-5 w-5" />,       label: '🏆 Excellent' },
  'Very Good': { color: 'bg-blue-500',    icon: <Star className="h-5 w-5" />,         label: '⭐ Very Good' },
  Good:        { color: 'bg-indigo-500',  icon: <CheckCircle2 className="h-5 w-5" />, label: '✅ Good' },
  Average:     { color: 'bg-amber-500',   icon: <CheckCircle2 className="h-5 w-5" />, label: '📊 Average' },
  Fail:        { color: 'bg-red-500',     icon: <AlertCircle className="h-5 w-5" />,  label: '❌ Fail' },
};

// ─── System prompt builder ────────────────────────────────────────────────────
function buildSystemPrompt(
  courseName: string,
  playgroundCode: string,
  projects: VivaProjectContext[],
): string {
  const hasPlayground = playgroundCode.length > 0;
  const hasProjects = projects.length > 0;

  // Build project context block
  const projectBlock = hasProjects
    ? projects.map((p, i) => {
        const lines = [
          `Project ${i + 1}: "${p.projectName}"`,
          `Description: ${p.projectDescription}`,
        ];
        if (p.submittedUrl) lines.push(`Submitted link: ${p.submittedUrl}`);
        if (p.submittedComment) lines.push(`Student's note: ${p.submittedComment}`);
        if (!p.submittedUrl) lines.push(`(Student has not yet submitted a link — ask about their progress and approach)`);
        return lines.join('\n');
      }).join('\n\n')
    : '';

  // Determine topic distribution based on what context is available
  let topicDistribution: string;
  if (hasPlayground && hasProjects) {
    topicDistribution = `- 35% Course Concepts: Key ideas, theory, and understanding from "${courseName}"
- 30% Coding Playground: Ask about the student's actual code (see below)
- 30% External Projects: Ask about each assigned project (see below)
- 5% Greeting/Closing/Feedback`;
  } else if (hasPlayground) {
    topicDistribution = `- 45% Course Concepts: Key ideas, theory, and understanding from "${courseName}"
- 50% Coding Playground: Ask about the student's actual code (see below)
- 5% Greeting/Closing/Feedback`;
  } else if (hasProjects) {
    topicDistribution = `- 45% Course Concepts: Key ideas, theory, and understanding from "${courseName}"
- 50% External Projects: Ask about each assigned project (see below)
- 5% Greeting/Closing/Feedback`;
  } else {
    topicDistribution = `- 90% Course Concepts: Key ideas, theory, and understanding from "${courseName}"
- 10% Greeting/Closing/Feedback`;
  }

  const playgroundSection = hasPlayground
    ? `\n## STUDENT'S CODING PLAYGROUND CODE\nReference this code when asking project questions. Ask about specific choices, logic, and understanding.\n\n${playgroundCode}`
    : '';

  const projectSection = hasProjects
    ? `\n## ASSIGNED EXTERNAL PROJECTS\nFor each project, ask about: understanding of the problem, tools/platforms used (Google Colab, GitHub, etc.), implementation approach, key observations, challenges faced, and results.\n\n${projectBlock}`
    : '';

  return `You are an AI Viva Examiner for the ViBe learning platform. You are conducting a friendly, professional oral examination for a student who has just completed the "${courseName}" course.

## YOUR PERSONA
- Friendly, professional, conversational — like a senior colleague having a chat
- Use 1-2 emojis only in your opening greeting and closing message
- Keep questions concise and natural, one at a time
- Never say "wrong answer" — probe deeper or move on gracefully

## TOPIC DISTRIBUTION (follow strictly)
${topicDistribution}

## ASSESSMENT APPROACH
Internally track mastery across the conversation. Evaluate:
- Conceptual clarity: Can they explain WHY, not just WHAT?
- Project ownership: Do they understand their own work and tools?
- Depth of reasoning: Can they handle follow-up probes?

Ask follow-up questions when answers are shallow. Move on when you have sufficient evidence.

## ADAPTIVE DURATION
- Minimum ~8 exchanges, maximum ~20 exchanges
- Stop when you have confident evidence for a grade
${playgroundSection}${projectSection}

## GRADING CRITERIA
- **Excellent**: Deep understanding of concepts and projects, insightful answers
- **Very Good**: Strong understanding with minor gaps
- **Good**: Solid grasp of most concepts, reasonable project understanding
- **Average**: Basic understanding, some gaps, but not fundamentally lost
- **Fail**: Fundamental lack of understanding in BOTH course concepts AND their own work

## ENDING THE VIVA
When you have sufficient evidence, emit EXACTLY this JSON on its own line (no markdown, no backticks):
{"viva_complete":true,"grade":"<Excellent|Very Good|Good|Average|Fail>","summary":"<1-2 sentence summary>"}

Then add a warm closing message.

## RULES
- Never reveal your internal mastery tracking
- Ask ONE question at a time
- Do not repeat questions
- Start with a warm greeting and your first question immediately`;
}

// ─── Gemini streaming ─────────────────────────────────────────────────────────
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const GEMINI_MODEL = 'gemini-2.0-flash';

async function* streamGemini(
  systemPrompt: string,
  history: Message[],
  userMessage: string,
): AsyncGenerator<string> {
  if (!GEMINI_API_KEY) {
    yield '⚠️ Gemini API key not configured. Please set VITE_GEMINI_API_KEY in your .env file.';
    return;
  }

  const contents = [
    ...history.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok || !res.body) {
    const errorText = await res.text();
    yield `Error from Gemini API: ${res.status} — ${errorText}`;
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (json === '[DONE]') return;
      try {
        const text: string = JSON.parse(json)?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        if (text) yield text;
      } catch { /* skip malformed */ }
    }
  }
}

// ─── Parse / clean viva result ────────────────────────────────────────────────
function parseVivaResult(text: string): { grade: VivaGrade; summary: string } | null {
  const match = text.match(/\{"viva_complete":true,"grade":"([^"]+)","summary":"([^"]+)"\}/);
  if (!match) return null;
  const grade = match[1] as VivaGrade;
  const valid: VivaGrade[] = ['Excellent', 'Very Good', 'Good', 'Average', 'Fail'];
  return valid.includes(grade) ? { grade, summary: match[2] } : null;
}

function cleanDisplayText(text: string): string {
  return text.replace(/\{"viva_complete":true[^}]+\}\n?/g, '').trim();
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AIVivaChat({ courseItemIds, courseName, projects = [], onComplete }: AIVivaChatProps) {
  // Each component instance has its own isolated state — multiple learners
  // can run simultaneously because each mounts a separate instance.
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [vivaResult, setVivaResult] = useState<{ grade: VivaGrade; summary: string } | null>(null);
  const [systemPrompt, setSystemPrompt] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Build system prompt on mount (reads localStorage for playground code)
  useEffect(() => {
    const code = readPlaygroundCode(courseItemIds);
    setSystemPrompt(buildSystemPrompt(courseName, code, projects));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (userText: string, currentMessages: Message[]) => {
    if (isStreaming) return;
    if (!userText.trim()) return;

    const newHistory: Message[] = [...currentMessages, { role: 'user', content: userText }];

    setMessages(newHistory);
    setInput('');

    setIsStreaming(true);
    setMessages(prev => [...newHistory, { role: 'assistant', content: '' }]);

    let fullText = '';
    try {
      for await (const chunk of streamGemini(systemPrompt, currentMessages, userText)) {
        fullText += chunk;
        const display = cleanDisplayText(fullText);
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: display };
          return updated;
        });
      }

      const result = parseVivaResult(fullText);
      if (result) {
        setVivaResult(result);
        onComplete?.(result.grade);
      }
    } catch (err: any) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${err.message}. Please try again.`,
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming, messages, systemPrompt, onComplete]);

  // Kick off opening greeting once system prompt is ready
  useEffect(() => {
    if (!systemPrompt || messages.length > 0) return;

    const startViva = async () => {
      setIsStreaming(true);
      setMessages([{ role: 'assistant', content: '' }]);
      let fullText = '';
      const prompt = 'Please begin the viva with your opening greeting and first question. Keep it concise.';
      try {
        for await (const chunk of streamGemini(systemPrompt, [], prompt)) {
          fullText += chunk;
          setMessages([{ role: 'assistant', content: cleanDisplayText(fullText) }]);
        }
      } catch (err: any) {
        setMessages([{ role: 'assistant', content: `Sorry, I encountered an error: ${err.message}. Please try again.` }]);
      } finally {
        setIsStreaming(false);
      }
    };

    startViva();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && input.trim()) sendMessage(input, messages);
    }
  };

  const gradeConfig = vivaResult ? GRADE_CONFIG[vivaResult.grade] : null;

  const handleReset = () => {
    setVivaResult(null);
    setMessages([]); // This will trigger the useEffect to start a new session
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-background rounded-xl border border-border overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/40 shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">AI Viva Examiner</p>
          <p className="text-xs text-muted-foreground truncate">{courseName} — Oral Assessment</p>
        </div>
        <Badge variant="outline" className="text-xs shrink-0">
          {isStreaming
            ? <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Thinking…</span>
            : vivaResult ? 'Completed' : 'In Progress'}
        </Badge>
      </div>

      {/* ── Project context chips (so student knows what will be discussed) ── */}
      {projects.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-2 border-b border-border bg-muted/20 shrink-0">
          <span className="text-[11px] text-muted-foreground self-center">Projects in scope:</span>
          {projects.map(p => (
            <div key={p.projectId} className="flex items-center gap-1">
              <Badge variant="secondary" className="text-[11px] gap-1">
                {p.projectName}
                {p.submittedUrl && (
                  <a
                    href={p.submittedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="opacity-60 hover:opacity-100"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* ── Grade result banner ── */}
      {vivaResult && gradeConfig && (
        <div className={cn('flex items-center gap-3 px-4 py-3 text-white shrink-0', gradeConfig.color)}>
          {gradeConfig.icon}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Final Grade: {gradeConfig.label}</p>
            <p className="text-xs opacity-90 truncate">{vivaResult.summary}</p>
          </div>
          {vivaResult.grade === 'Fail' && (
            <Button size="sm" variant="secondary" onClick={handleReset} className="shrink-0 gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Retry
            </Button>
          )}
        </div>
      )}

      {/* ── Messages ── */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
              <div className={cn(
                'flex items-center justify-center w-7 h-7 rounded-full shrink-0 mt-0.5',
                msg.role === 'assistant' ? 'bg-primary/10' : 'bg-secondary',
              )}>
                {msg.role === 'assistant'
                  ? <Bot className="h-3.5 w-3.5 text-primary" />
                  : <User className="h-3.5 w-3.5 text-secondary-foreground" />}
              </div>
              <div className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                msg.role === 'assistant'
                  ? 'bg-muted text-foreground rounded-tl-sm'
                  : 'bg-primary text-primary-foreground rounded-tr-sm',
              )}>
                {msg.content || (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* ── Input ── */}
      {!vivaResult && (
        <div className="px-4 py-3 border-t border-border bg-muted/20 shrink-0">
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer… (Enter to send, Shift+Enter for new line)"
              className="flex-1 min-h-[44px] max-h-32 resize-none text-sm"
              disabled={isStreaming}
              rows={1}
            />
            <Button
              size="icon"
              onClick={() => sendMessage(input, messages)}
              disabled={isStreaming || !input.trim()}
              className="h-11 w-11 shrink-0"
            >
              {isStreaming
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-right">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      )}

      {/* ── Post-completion actions ── */}
      {vivaResult && vivaResult.grade !== 'Fail' && (
        <div className="px-4 py-3 border-t border-border bg-muted/20 shrink-0 flex justify-end">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Retake Viva
          </Button>
        </div>
      )}
    </div>
  );
}
