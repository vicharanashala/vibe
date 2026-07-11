import { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { X, Download, Play, Code2, Loader2, Maximize2, Minimize2, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/utils';

// ─── Language config ──────────────────────────────────────────────────────────
const LANGUAGES = [
  { id: 'python',     label: 'Python',     monaco: 'python',     ext: 'py',   isWeb: false },
  { id: 'javascript', label: 'JavaScript', monaco: 'javascript', ext: 'js',   isWeb: false },
  { id: 'typescript', label: 'TypeScript', monaco: 'typescript', ext: 'ts',   isWeb: false },
  { id: 'java',       label: 'Java',       monaco: 'java',       ext: 'java', isWeb: false },
  { id: 'cpp',        label: 'C++',        monaco: 'cpp',        ext: 'cpp',  isWeb: false },
  { id: 'c',          label: 'C',          monaco: 'c',          ext: 'c',    isWeb: false },
  { id: 'html',       label: 'HTML',       monaco: 'html',       ext: 'html', isWeb: true  },
  { id: 'css',        label: 'CSS',        monaco: 'css',        ext: 'css',  isWeb: true  },
  { id: 'json',       label: 'JSON',       monaco: 'json',       ext: 'json', isWeb: true  },
  { id: 'mongodb',    label: 'MongoDB',    monaco: 'javascript', ext: 'js',   isWeb: false },
] as const;

type LangId = typeof LANGUAGES[number]['id'];

const DEFAULT_CODE: Record<LangId, string> = {
  python: `# Python Playground
def greet(name):
    return f"Hello, {name}!"

print(greet("ViBe"))
print("Sum:", sum([1, 2, 3, 4, 5]))`,

  javascript: `// JavaScript Playground
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet("ViBe"));
console.log("Sum:", [1,2,3,4,5].reduce((a,b) => a+b, 0));`,

  typescript: `// TypeScript Playground
const greet = (name: string): string => \`Hello, \${name}!\`;

console.log(greet("ViBe"));
const nums: number[] = [1, 2, 3, 4, 5];
console.log("Sum:", nums.reduce((a, b) => a + b, 0));`,

  java: `// Java Playground
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, ViBe!");
        int sum = 0;
        for (int i = 1; i <= 5; i++) sum += i;
        System.out.println("Sum: " + sum);
    }
}`,

  cpp: `// C++ Playground
#include <iostream>
using namespace std;

int main() {
    cout << "Hello, ViBe!" << endl;
    int sum = 0;
    for (int i = 1; i <= 5; i++) sum += i;
    cout << "Sum: " << sum << endl;
    return 0;
}`,

  c: `// C Playground
#include <stdio.h>

int main() {
    printf("Hello, ViBe!\\n");
    int sum = 0;
    for (int i = 1; i <= 5; i++) sum += i;
    printf("Sum: %d\\n", sum);
    return 0;
}`,

  html: `<!DOCTYPE html>
<html>
<head>
  <title>ViBe Preview</title>
  <style>
    body { font-family: sans-serif; padding: 24px; background: #f0f4f8; }
    h1 { color: #3b82f6; }
    p { color: #374151; }
  </style>
</head>
<body>
  <h1>Hello, ViBe! 🎓</h1>
  <p>Edit this HTML to see a live preview.</p>
</body>
</html>`,

  css: `/* CSS Playground */
body {
  font-family: sans-serif;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  margin: 0;
}
.card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  text-align: center;
}`,

  json: `{
  "course": "Machine Learning",
  "topics": ["Regression", "Classification", "Clustering"],
  "difficulty": "Intermediate",
  "rating": 4.8
}`,

  mongodb: `// MongoDB Query Playground
// Simulated — shows query syntax only

db.students.find(
  { score: { $gte: 80 } },
  { name: 1, score: 1, _id: 0 }
).sort({ score: -1 }).limit(5);`,
};

// ─── Pyodide loader (singleton) ───────────────────────────────────────────────
let pyodideInstance: any = null;
let pyodideLoading = false;
let pyodideCallbacks: Array<(py: any) => void> = [];

async function getPyodide(): Promise<any> {
  if (pyodideInstance) return pyodideInstance;
  if (pyodideLoading) {
    return new Promise(resolve => pyodideCallbacks.push(resolve));
  }
  pyodideLoading = true;
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js';
  document.head.appendChild(script);
  await new Promise<void>(resolve => { script.onload = () => resolve(); });
  const py = await (window as any).loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/' });
  pyodideInstance = py;
  pyodideCallbacks.forEach(cb => cb(py));
  pyodideCallbacks = [];
  return py;
}

// ─── Code executor ────────────────────────────────────────────────────────────
async function runCode(langId: LangId, code: string): Promise<string> {
  // JavaScript — run in browser directly
  if (langId === 'javascript' || langId === 'typescript' || langId === 'nodejs') {
    const logs: string[] = [];
    const fakeConsole = {
      log: (...args: any[]) => logs.push(args.map(String).join(' ')),
      error: (...args: any[]) => logs.push('ERROR: ' + args.map(String).join(' ')),
      warn: (...args: any[]) => logs.push('WARN: ' + args.map(String).join(' ')),
    };
    try {
      // Strip TypeScript type annotations for execution
      let execCode = code;
      if (langId === 'typescript') {
        execCode = code
          .replace(/:\s*\w+(\[\])?(\s*\|[\s\w\[\]]+)*/g, '')
          .replace(/<[^>]+>/g, '');
      }
      const fn = new Function('console', execCode);
      fn(fakeConsole);
      return logs.length > 0 ? logs.join('\n') : '(no output)';
    } catch (e: any) {
      return `Error: ${e.message}`;
    }
  }

  // Python — run via Pyodide (real CPython in WebAssembly)
  if (langId === 'python') {
    try {
      const py = await getPyodide();
      // Capture stdout
      await py.runPythonAsync(`
import sys
import io
_stdout_capture = io.StringIO()
sys.stdout = _stdout_capture
`);
      try {
        await py.runPythonAsync(code);
      } catch (e: any) {
        await py.runPythonAsync(`sys.stdout = sys.__stdout__`);
        return `Error: ${e.message}`;
      }
      const output = await py.runPythonAsync(`
_out = _stdout_capture.getvalue()
sys.stdout = sys.__stdout__
_out
`);
      return output?.trim() || '(no output)';
    } catch (e: any) {
      return `Error loading Python runtime: ${e.message}`;
    }
  }

  // JSON — validate and pretty print
  if (langId === 'json') {
    try {
      const parsed = JSON.parse(code);
      return JSON.stringify(parsed, null, 2);
    } catch (e: any) {
      return `JSON Error: ${e.message}`;
    }
  }

  // MongoDB — syntax only
  if (langId === 'mongodb') {
    return `✅ Query syntax looks valid.\n\nNote: Actual execution requires a live MongoDB connection.\nThis playground validates query structure only.`;
  }

  // HTML/CSS — handled by live preview, not output panel
  if (langId === 'html' || langId === 'css') {
    return '✅ See the Live Preview panel →';
  }

  // C, C++, Java — Judge0 free public instance (no API key needed)
  const JUDGE0_URL = 'https://ce.judge0.com';
  const LANG_IDS: Partial<Record<LangId, number>> = { c: 50, cpp: 54, java: 62 };
  const judge0LangId = LANG_IDS[langId];
  if (!judge0LangId) return 'Language not supported for execution.';

  // Judge0 requires base64 encoded source and returns base64 encoded output
  const b64encode = (str: string) => btoa(unescape(encodeURIComponent(str)));
  const b64decode = (str: string) => {
    try { return decodeURIComponent(escape(atob(str))); } catch { return str; }
  };

  try {
    const submitRes = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=true&wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_code: b64encode(code),
        language_id: judge0LangId,
      }),
    });

    if (!submitRes.ok) return `Server error: ${submitRes.status}`;

    const data = await submitRes.json();

    if (data.stdout) return b64decode(data.stdout).trim();
    if (data.stderr) return `Runtime Error:\n${b64decode(data.stderr).trim()}`;
    if (data.compile_output) return `Compile Error:\n${b64decode(data.compile_output).trim()}`;
    if (data.message) return b64decode(data.message).trim();
    return data.status?.description || 'No output';
  } catch (e: any) {
    return `Network error: ${e.message}`;
  }
}

// ─── Web preview src ──────────────────────────────────────────────────────────
function getPreviewSrc(langId: LangId, code: string): string {
  if (langId === 'html') return code;
  if (langId === 'css') {
    return `<!DOCTYPE html><html><head><style>${code}</style></head><body><div class="card"><h2>CSS Preview</h2><p>Your styles are applied here.</p></div></body></html>`;
  }
  if (langId === 'json') {
    try {
      const pretty = JSON.stringify(JSON.parse(code), null, 2);
      return `<!DOCTYPE html><html><body style="font-family:monospace;padding:16px;background:#1e1e1e;color:#d4d4d4"><pre>${pretty}</pre></body></html>`;
    } catch {
      return `<!DOCTYPE html><html><body style="padding:16px;color:red;font-family:monospace">Invalid JSON</body></html>`;
    }
  }
  return '';
}

// ─── Storage helpers ──────────────────────────────────────────────────────────
const storageKey = (itemId: string, langId: string) => `vibe-pg-${itemId}-${langId}`;

function loadCode(itemId: string, langId: LangId): string {
  return localStorage.getItem(storageKey(itemId, langId)) ?? DEFAULT_CODE[langId];
}

function saveCode(itemId: string, langId: LangId, code: string) {
  localStorage.setItem(storageKey(itemId, langId), code);
}

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  courseItemId: string;
  onClose: () => void;
}

export default function CodingPlayground({ courseItemId, onClose }: Props) {
  const [langId, setLangId] = useState<LangId>('python');
  const [code, setCode] = useState<string>(() => loadCode(courseItemId, 'python'));
  const [output, setOutput] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [activePanel, setActivePanel] = useState<'output' | 'preview'>('output');

  const currentLang = LANGUAGES.find(l => l.id === langId)!;

  // ── Drag state ──────────────────────────────────────────────────────────────
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 900, h: 580 });
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragOrigin = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const resizeOrigin = useRef({ mx: 0, my: 0, ow: 0, oh: 0 });

  // Center on mount
  useEffect(() => {
    const w = Math.min(900, window.innerWidth - 48);
    const h = Math.min(580, window.innerHeight - 48);
    setSize({ w, h });
    setPos({ x: (window.innerWidth - w) / 2, y: (window.innerHeight - h) / 2 });
  }, []);

  // Mouse move/up for drag + resize
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isDragging.current) {
        setPos({
          x: Math.max(0, Math.min(dragOrigin.current.ox + e.clientX - dragOrigin.current.mx, window.innerWidth - size.w)),
          y: Math.max(0, Math.min(dragOrigin.current.oy + e.clientY - dragOrigin.current.my, window.innerHeight - size.h)),
        });
      }
      if (isResizing.current) {
        setSize({
          w: Math.max(520, resizeOrigin.current.ow + e.clientX - resizeOrigin.current.mx),
          h: Math.max(380, resizeOrigin.current.oh + e.clientY - resizeOrigin.current.my),
        });
      }
    };
    const onUp = () => { isDragging.current = false; isResizing.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [size.w, size.h]);

  // ── Language switch ─────────────────────────────────────────────────────────
  const handleLangChange = (newLangId: LangId) => {
    saveCode(courseItemId, langId, code);       // save current before leaving
    const newCode = loadCode(courseItemId, newLangId);
    setLangId(newLangId);
    setCode(newCode);
    setOutput('');
    const newLang = LANGUAGES.find(l => l.id === newLangId)!;
    setActivePanel(newLang.isWeb ? 'preview' : 'output');
  };

  // ── Auto-save on every keystroke ────────────────────────────────────────────
  const handleCodeChange = (val: string | undefined) => {
    const newCode = val ?? '';
    setCode(newCode);
    saveCode(courseItemId, langId, newCode);    // persists to localStorage immediately
  };

  // ── Save on unmount (close/navigate away) ───────────────────────────────────
  const langIdRef = useRef(langId);
  const codeRef = useRef(code);
  useEffect(() => { langIdRef.current = langId; }, [langId]);
  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => {
    return () => saveCode(courseItemId, langIdRef.current, codeRef.current);
  }, [courseItemId]);

  // ── Run code ────────────────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setOutput('');
    setActivePanel(currentLang.isWeb ? 'preview' : 'output');
    try {
      const result = await runCode(langId, code);
      setOutput(result);
    } catch (e: any) {
      setOutput(`Error: ${e.message}`);
    } finally {
      setIsRunning(false);
    }
  }, [langId, code, currentLang.isWeb]);

  // Ctrl+Enter to run
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleRun(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleRun]);

  // ── Download ────────────────────────────────────────────────────────────────
  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playground.${currentLang.ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Maximize toggle ─────────────────────────────────────────────────────────
  const containerStyle = isMaximized
    ? { left: 0, top: 0, width: '100vw', height: '100vh' }
    : { left: pos.x, top: pos.y, width: size.w, height: size.h };

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none" style={{ isolation: 'isolate' }}>
      <div
        className="pointer-events-auto absolute flex flex-col bg-[#1e1e1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
        style={containerStyle}
      >
        {/* ── Title bar ── */}
        <div
          className={cn('flex items-center gap-2 px-3 py-2 bg-[#2d2d2d] border-b border-white/10 select-none shrink-0', !isMaximized && 'cursor-move')}
          onMouseDown={e => {
            if (isMaximized) return;
            // Only drag from the bar itself, not from buttons inside it
            if ((e.target as HTMLElement).closest('button, select, [role="combobox"]')) return;
            isDragging.current = true;
            dragOrigin.current = { mx: e.clientX, my: e.clientY, ox: pos.x, oy: pos.y };
          }}
        >
          <GripHorizontal className="h-4 w-4 text-white/30 shrink-0" />
          <Code2 className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="text-white text-sm font-semibold">Coding Playground</span>

          {/* Language selector — native select to avoid portal issues */}
          <select
            value={langId}
            onChange={e => handleLangChange(e.target.value as LangId)}
            className="ml-2 h-7 rounded px-2 text-xs bg-[#3c3c3c] text-white border border-white/20 focus:outline-none focus:border-blue-400 cursor-pointer"
            onMouseDown={e => e.stopPropagation()}
          >
            {LANGUAGES.map(l => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={handleDownload}
              title="Download code"
              className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setIsMaximized(m => !m)}
              title={isMaximized ? 'Restore' : 'Maximize'}
              className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition"
            >
              {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="p-1.5 rounded hover:bg-red-500/20 text-white/60 hover:text-red-400 transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Run bar ── */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#252526] border-b border-white/10 shrink-0">
          <Button
            size="sm"
            onClick={handleRun}
            disabled={isRunning}
            className="h-7 gap-1.5 text-xs bg-green-600 hover:bg-green-500 text-white border-0"
          >
            {isRunning
              ? <><Loader2 className="h-3 w-3 animate-spin" /> Running…</>
              : <><Play className="h-3 w-3" /> Run  (Ctrl+↵)</>
            }
          </Button>

          {/* Panel toggle for web languages */}
          {currentLang.isWeb && (
            <div className="flex rounded overflow-hidden border border-white/20 text-xs">
              <button
                onClick={() => setActivePanel('output')}
                className={cn('px-2.5 py-1 transition', activePanel === 'output' ? 'bg-blue-600 text-white' : 'bg-[#3c3c3c] text-white/60 hover:text-white')}
              >Output</button>
              <button
                onClick={() => setActivePanel('preview')}
                className={cn('px-2.5 py-1 transition', activePanel === 'preview' ? 'bg-blue-600 text-white' : 'bg-[#3c3c3c] text-white/60 hover:text-white')}
              >Preview</button>
            </div>
          )}

          <span className="ml-auto text-white/30 text-[10px]">{currentLang.label}</span>
        </div>

        {/* ── Editor + Output ── */}
        <div className="flex flex-1 min-h-0">
          {/* Monaco editor */}
          <div className="flex-1 min-w-0">
            <Editor
              height="100%"
              language={currentLang.monaco}
              value={code}
              onChange={handleCodeChange}
              theme="vs-dark"
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                lineNumbers: 'on',
                renderLineHighlight: 'line',
                padding: { top: 8, bottom: 8 },
                automaticLayout: true,
              }}
            />
          </div>

          {/* Right panel */}
          <div className="w-72 shrink-0 flex flex-col border-l border-white/10">
            {activePanel === 'preview' && currentLang.isWeb ? (
              <>
                <div className="px-3 py-1.5 text-[11px] text-white/40 bg-[#252526] border-b border-white/10 shrink-0">
                  Live Preview
                </div>
                <iframe
                  key={`${langId}-${code.length}`}
                  title="preview"
                  srcDoc={getPreviewSrc(langId, code)}
                  sandbox="allow-scripts"
                  className="flex-1 bg-white border-0"
                />
              </>
            ) : (
              <>
                <div className="px-3 py-1.5 text-[11px] text-white/40 bg-[#252526] border-b border-white/10 shrink-0">
                  Output
                </div>
                <div className="flex-1 overflow-auto p-3 font-mono text-xs text-zinc-100 bg-[#1a1a1a]">
                  {isRunning && (
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {langId === 'python' ? 'Loading Python runtime…' : 'Running…'}
                    </div>
                  )}
                  {!isRunning && !output && (
                    <p className="text-zinc-500">Press Run to execute your code.</p>
                  )}
                  {!isRunning && output && (
                    <pre className="whitespace-pre-wrap text-green-400">{output}</pre>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Resize handle ── */}
        {!isMaximized && (
          <div
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-10"
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              isResizing.current = true;
              resizeOrigin.current = { mx: e.clientX, my: e.clientY, ow: size.w, oh: size.h };
            }}
            style={{
              background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.2) 50%)',
            }}
          />
        )}
      </div>
    </div>
  );
}
