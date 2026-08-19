/**
 * CodeLab — in-lecture coding workspace (product.md §6.20).
 *
 * Split-screen: editor + terminal/output on the left, paused video on the right.
 * Draggable divider, default 50/50 split. Workspace management: create/rename/
 * delete/edit files, 5-file cap, 50 KB per-file cap, ZIP download, reset.
 * Read-only templates for heavyweight runtimes (MongoDB, Node.js, NumPy, etc.).
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import {
  useCodeLabStore,
  MAX_FILES,
  READ_ONLY_LANGUAGES,
  type CodeLabFile,
} from '@/store/codelab-store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Play,
  Plus,
  Download,
  RotateCcw,
  X,
  Edit3,
  Check,
  Trash2,
  Terminal,
  FileCode2,
  Lock,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { transform as sucraseTransform } from 'sucrase';

// ──────────────────────────────────────────────────────────────────────────
// Read-only templates for heavyweight / unsupported runtimes.
// Each entry has source code + predefined terminal output.
// ──────────────────────────────────────────────────────────────────────────

interface Template {
  language: string;
  label: string;
  filename: string;
  source: string;
  output: string;
}

const READ_ONLY_TEMPLATES: Template[] = [
  {
    language: 'mongodb',
    label: 'MongoDB',
    filename: 'query.js',
    source: `// MongoDB — read-only template
// This example shows a basic CRUD operation with the MongoDB Node.js driver.

const { MongoClient } = require('mongodb');

async function main() {
  const uri = 'mongodb://localhost:27017';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('learndb');
    const col = db.collection('students');

    // Insert
    await col.insertOne({ name: 'Alice', score: 95 });

    // Find
    const students = await col.find({ score: { $gte: 90 } }).toArray();
    console.log('High scorers:', students);

    // Update
    await col.updateOne({ name: 'Alice' }, { $set: { score: 98 } });

    // Delete
    await col.deleteOne({ name: 'Alice' });
  } finally {
    await client.close();
  }
}

main().catch(console.error);`,
    output: `> Connecting to MongoDB at mongodb://localhost:27017 …
> Connected.
> Inserted: { _id: ObjectId("..."), name: 'Alice', score: 95 }
> High scorers: [ { _id: ObjectId("..."), name: 'Alice', score: 95 } ]
> Updated: { matchedCount: 1, modifiedCount: 1 }
> Deleted: { deletedCount: 1 }
> Connection closed.`,
  },
  {
    language: 'node',
    label: 'Node.js',
    filename: 'server.js',
    source: `// Node.js — read-only template
// A minimal HTTP server using the built-in 'http' module.

const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from Node.js!\n');
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000/');
});`,
    output: `> Server running at http://localhost:3000/
> GET / 200 — "Hello from Node.js!"`,
  },
  {
    language: 'express',
    label: 'Express.js',
    filename: 'app.js',
    source: `// Express.js — read-only template
// A minimal REST API with Express.

const express = require('express');
const app = express();
app.use(express.json());

const items = [];

app.get('/items', (req, res) => res.json(items));

app.post('/items', (req, res) => {
  const item = { id: items.length + 1, ...req.body };
  items.push(item);
  res.status(201).json(item);
});

app.listen(3000, () => console.log('Express server on port 3000'));`,
    output: `> Express server on port 3000
> POST /items 201 — { id: 1, name: 'Widget' }
> GET  /items 200 — [{ id: 1, name: 'Widget' }]`,
  },
  {
    language: 'numpy',
    label: 'NumPy',
    filename: 'demo.py',
    source: `# NumPy — read-only template
# Basic array operations.

import numpy as np

a = np.array([1, 2, 3, 4, 5])
b = np.array([10, 20, 30, 40, 50])

print("a =", a)
print("b =", b)
print("a + b =", a + b)
print("dot(a, b) =", np.dot(a, b))
print("mean(a) =", np.mean(a))
print("std(a)  =", np.std(a))

mat = np.arange(9).reshape(3, 3)
print("Matrix:\\n", mat)
print("Transpose:\\n", mat.T)`,
    output: `a = [1 2 3 4 5]
b = [10 20 30 40 50]
a + b = [11 22 33 44 55]
dot(a, b) = 550
mean(a) = 3.0
std(a)  = 1.4142135623730951
Matrix:
 [[0 1 2]
  [3 4 5]
  [6 7 8]]
Transpose:
 [[0 3 6]
  [1 4 7]
  [2 5 8]]`,
  },
  {
    language: 'pandas',
    label: 'Pandas',
    filename: 'analysis.py',
    source: `# Pandas — read-only template
import pandas as pd

data = {
    'name':  ['Alice', 'Bob', 'Carol', 'Dave'],
    'score': [92, 85, 78, 95],
    'grade': ['A', 'B', 'C', 'A'],
}

df = pd.DataFrame(data)
print(df)
print("\\nAverage score:", df['score'].mean())
print("Grade counts:\\n", df['grade'].value_counts())`,
    output: `    name  score grade
0  Alice     92     A
1    Bob     85     B
2  Carol     78     C
3   Dave     95     A

Average score: 87.5
Grade counts:
 A    2
 B    1
 C    1
Name: grade, dtype: int64`,
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    jsx: 'javascript',
    tsx: 'typescript',
    py: 'python',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    sh: 'shell',
    java: 'java',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    go: 'go',
    rs: 'rust',
  };
  return map[ext] ?? 'text';
}

function languageIsReadOnly(lang: string): boolean {
  return READ_ONLY_LANGUAGES.has(lang.toLowerCase());
}

function getTemplate(lang: string): Template | null {
  return (
    READ_ONLY_TEMPLATES.find((t) => t.language === lang.toLowerCase()) ?? null
  );
}

/**
 * Regex that matches a value-import statement (not 'import type').
 * Captures the module specifier from:
 *   import { foo } from 'pkg'
 *   import foo from "pkg"
 *   import * as foo from 'pkg'
 *   import 'pkg'               (side-effect import)
 * Does NOT match:
 *   import type { Foo } from 'pkg'   (type-only, erased by TS transform)
 */
const VALUE_IMPORT_RE =
  /^\s*import(?!\s+type\b)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm;

/**
 * Transpile TypeScript source to JavaScript using Sucrase (TS-1 + TS-3).
 *
 * TS-1: strips TypeScript syntax (type annotations, interfaces, generics…).
 * TS-3: converts import/export ES-module syntax to CommonJS via sucrase's
 *       'imports' transform, so eval() no longer throws a SyntaxError on them.
 *
 * Pre-scan (TS-3): any value import statement is detected BEFORE transpilation.
 * Since this sandbox has no module resolver, such imports cannot be fulfilled.
 * We return a clear labeled error instead of letting require() throw at runtime.
 *
 * Returns:
 *   { code, hasExports } on success — hasExports=true when the source contained
 *     export statements (caller must inject an `exports` shim into the sandbox).
 *   { error } on transpile failure or unresolvable import.
 */
function transpileTypeScript(
  source: string,
): { code: string; hasExports: boolean } | { error: string } {
  // ── TS-3: pre-scan for value imports ────────────────────────────────────
  // Reset lastIndex before each use of the global regex.
  VALUE_IMPORT_RE.lastIndex = 0;
  const importMatch = VALUE_IMPORT_RE.exec(source);
  if (importMatch) {
    const specifier = importMatch[1];
    return {
      error:
        `Cannot resolve module '${specifier}': package imports are not yet ` +
        `supported in the sandbox. Remove the import or use only type-only ` +
        `imports (import type …).`,
    };
  }

  // ── TS-1 + TS-3: transpile ───────────────────────────────────────────────
  // 'typescript' strips TS-only syntax.
  // 'imports'    converts export/import syntax to CommonJS, preventing
  //              SyntaxError when the transpiled code is eval()'d.
  const hasExports = /^\s*export\b/m.test(source);
  try {
    const result = sucraseTransform(source, {
      transforms: ['typescript', 'imports'],
    });
    return { code: result.code, hasExports };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

// ── JS-1: JavaScript import/export and CDN support ────────────────────────
//
// Plain JavaScript files share the same iframe sandbox as TypeScript files.
// TS-2 (async capture) and TS-5 (Node shims) already apply to JS because they
// are injected into the shared eval context — no changes needed for those.
//
// What was missing for JS:
//   - import/export syntax → SyntaxError in eval (TS-3 only wired for TS)
//   - npm package imports → unresolved (TS-4 only wired for TS)
//
// This function handles the JS code path analogously to transpileTypeScript()
// but WITHOUT the 'typescript' Sucrase transform (plain JS needs no type strip).

/**
 * Process plain JavaScript source for sandbox execution (JS-1).
 *
 * Mirrors the TS-3 path from transpileTypeScript() but uses only the Sucrase
 * 'imports' transform (no 'typescript' transform — JS needs no type stripping).
 *
 * - If the source has external npm imports, caller should route to CDN path.
 * - If the source has local export statements, converts them to CommonJS.
 * - If the source has no imports/exports, returns code unchanged.
 *
 * Returns:
 *   { code, hasExports } on success.
 *   { error } if the 'imports' transform fails (syntax error in source).
 */
function processJavaScript(
  source: string,
): { code: string; hasExports: boolean } | { error: string } {
  const hasExports = /^\s*export\b/m.test(source);
  const hasImports = VALUE_IMPORT_RE.lastIndex === 0 && VALUE_IMPORT_RE.test(source);
  VALUE_IMPORT_RE.lastIndex = 0; // always reset after use

  if (!hasExports && !hasImports) {
    // No ES module syntax — return unchanged, no transform needed.
    return { code: source, hasExports: false };
  }

  // Apply only the 'imports' transform: converts export/import to CommonJS
  // so eval() no longer throws SyntaxError on ES module syntax.
  // (Same as TS-3 but without 'typescript' in the transforms array.)
  try {
    const result = sucraseTransform(source, { transforms: ['imports'] });
    return { code: result.code, hasExports };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}


// ── TS-5: Node.js global shims ────────────────────────────────────────────
//
// The iframe sandbox is a plain browser context. Code that references Node.js
// globals (process, Buffer, require, fs, path, os, etc.) would otherwise get
// a raw ReferenceError with no useful message.
//
// This shim block is injected BEFORE user code in EVERY iframe execution
// context (both the eval path and the CDN srcdoc path).  It is sandboxed to
// the iframe — the parent application is never affected.
//
// Design choices:
//   process  — shim with common fields (env, argv, exit, version, platform).
//              process.exit() logs a message and throws to halt execution.
//   Buffer   — minimal functional stub covering Buffer.from() + .toString()
//              for utf8 ↔ base64 (the patterns most learners use).  A full
//              polyfill (~100 KB) would be disproportionate for a teaching
//              sandbox.  Unsupported encodings/methods fail with a clear label.
//   require  — stub that returns a labeled-error proxy for known Node built-ins
//              and a generic message for unknown specifiers.
//   fs, path, os, crypto, http, https, stream, events, util, child_process —
//              named variable stubs that throw a clear labeled message on any
//              property access, covering the most common Node-only APIs.

const NODE_SHIM_JS = `
(function() {
  /* ── process shim ─────────────────────────────────────────────────── */
  if (typeof process === 'undefined') {
    var process = {
      env: {},
      argv: [],
      version: '',
      versions: {},
      platform: 'browser',
      exit: function(code) {
        throw new Error('process.exit(' + (code || 0) + ') called — execution halted.');
      },
      cwd: function() { return '/'; },
      hrtime: function() { return [0, 0]; },
      nextTick: function(fn) { setTimeout(fn, 0); },
      stdout: { write: function() {} },
      stderr: { write: function() {} },
    };
    /* Make process available as a global inside eval scope */
    window.process = process;
  }

  /* ── Buffer stub ──────────────────────────────────────────────────── */
  /* Minimal: Buffer.from(string, encoding?) → BufferLike with .toString(enc) */
  /* Covers the common utf8 ↔ base64 patterns used in teaching examples.    */
  if (typeof Buffer === 'undefined') {
    var Buffer = {
      from: function(data, inputEncoding) {
        var enc = (inputEncoding || 'utf8').toLowerCase();
        if (typeof data === 'string') {
          var _raw = data;
          var _enc = enc;
          return {
            _raw: _raw,
            _enc: _enc,
            toString: function(outputEncoding) {
              var out = (outputEncoding || 'utf8').toLowerCase();
              /* utf8 → base64 */
              if (_enc === 'utf8' && out === 'base64') {
                try { return btoa(unescape(encodeURIComponent(_raw))); }
                catch(e) { return btoa(_raw); }
              }
              /* base64 → utf8 */
              if (_enc === 'base64' && out === 'utf8') {
                try { return decodeURIComponent(escape(atob(_raw))); }
                catch(e) { return atob(_raw); }
              }
              /* utf8 → hex */
              if (_enc === 'utf8' && out === 'hex') {
                var hex = '';
                for (var i = 0; i < _raw.length; i++) {
                  var h = _raw.charCodeAt(i).toString(16);
                  hex += (h.length < 2 ? '0' : '') + h;
                }
                return hex;
              }
              /* identity */
              if (_enc === out) return _raw;
              throw new Error(
                'Buffer stub: encoding conversion ' + _enc + ' → ' + out +
                ' is not supported in this sandbox. Use utf8↔base64 or utf8↔hex.'
              );
            },
            length: _raw.length,
          };
        }
        throw new Error(
          'Buffer.from() in this sandbox only accepts strings. ' +
          'Uint8Array/ArrayBuffer inputs are not supported by the stub.'
        );
      },
      isBuffer: function(obj) {
        return !!(obj && typeof obj.toString === 'function' && '_raw' in obj);
      },
      concat: function() {
        throw new Error('Buffer.concat() is not supported in this sandbox stub.');
      },
      alloc: function() {
        throw new Error('Buffer.alloc() is not supported in this sandbox stub.');
      },
    };
    window.Buffer = Buffer;
  }

  /* ── unavailable-module proxy factory ─────────────────────────────── */
  function _makeUnavailable(name) {
    var msg = "'" + name + "' is not available in this browser sandbox. " +
              "This is a Node.js built-in module that cannot run in a browser context.";
    var handler = {
      get: function(_, prop) {
        /* Allow typeof checks to return 'undefined' without throwing */
        if (prop === 'then' || prop === Symbol.toPrimitive || prop === Symbol.iterator) return undefined;
        throw new ReferenceError(msg);
      },
      apply: function() { throw new ReferenceError(msg); },
      construct: function() { throw new ReferenceError(msg); },
    };
    try {
      return new Proxy(function(){}, handler);
    } catch(e) {
      /* Proxy not available — return a plain object with a throwing getter */
      var stub = {};
      Object.defineProperty(stub, '__unavailable__', { get: function() { throw new ReferenceError(msg); } });
      return stub;
    }
  }

  /* ── require() stub ───────────────────────────────────────────────── */
  if (typeof require === 'undefined') {
    var _nodeBuiltins = [
      'fs','path','os','crypto','http','https','net','tls',
      'stream','events','util','child_process','cluster','dns',
      'readline','repl','vm','worker_threads','assert','zlib',
      'url','querystring','string_decoder','timers','tty','dgram',
    ];
    var require = function(id) {
      if (_nodeBuiltins.indexOf(id) !== -1) return _makeUnavailable(id);
      throw new Error(
        "require('" + id + "') is not supported in this browser sandbox. " +
        "Use import statements for CDN-resolved packages instead."
      );
    };
    window.require = require;
  }

  /* ── named stubs for common Node built-ins ───────────────────────── */
  /* These ensure \`const fs = require('fs')\` alternatives like          */
  /* \`import fs from 'fs'\` after CDN resolution also fail gracefully.   */
  var _builtinNames = [
    'fs','path','os','crypto','http','https','net','tls',
    'stream','events','util','child_process','readline','zlib',
  ];
  for (var _i = 0; _i < _builtinNames.length; _i++) {
    var _n = _builtinNames[_i];
    if (typeof window[_n] === 'undefined') {
      window[_n] = _makeUnavailable(_n);
    }
  }
})();
`;


// ── TS-4: CDN-based npm package import resolution ──────────────────────────
// When a TypeScript file contains external npm imports, we resolve them live
// from esm.sh using the browser's native importmap feature.

/** CDN base URL. esm.sh produces true ESM output with TypeScript support. */
const CDN_BASE = 'https://esm.sh';

/**
 * Regex that matches ONLY external package specifiers (not relative paths or
 * absolute URLs).  Relative paths start with '.' or '/', absolute URLs with
 * 'https://' etc.  This is distinct from VALUE_IMPORT_RE (which matches all).
 */
const EXTERNAL_PKG_RE =
  /^\s*import(?!\s+type\b)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"./][^'"]*)['"]/gm;

/**
 * Extract all unique external npm specifiers from TypeScript source.
 * Returns [] if the source has no external imports.
 */
function getExternalSpecifiers(source: string): string[] {
  const specs: string[] = [];
  EXTERNAL_PKG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EXTERNAL_PKG_RE.exec(source)) !== null) {
    if (!specs.includes(m[1])) specs.push(m[1]);
  }
  return specs;
}

/**
 * Build the srcdoc HTML for a CDN-import enabled iframe.
 *
 * Strategy:
 * 1. An <importmap> script maps each npm specifier to its esm.sh URL.
 * 2. A non-module <script> registers window.onerror and window.onunhandledrejection
 *    so that CDN-fetch failures (e.g. typo'd package name → 404) produce a
 *    clear labeled message rather than a silent failure.
 * 3. A <script type="module"> contains:
 *    - The user's type-stripped code (import statements are at the top of the
 *      source so they remain at the top of the module — ES spec requires this).
 *    - A console shim that postMessages each log line to the parent (TS-2).
 *    - A try/catch around the non-import body to catch runtime errors.
 *    - A final postMessage({type:'done'}) to signal completion (TS-2).
 */
function buildCdnSrcdoc(typeStrippedCode: string, externalSpecifiers: string[]): string {
  // Build the import map object.
  const importsObj: Record<string, string> = {};
  for (const spec of externalSpecifiers) {
    importsObj[spec] = `${CDN_BASE}/${spec}`;
  }
  const importMapJson = JSON.stringify({ imports: importsObj });

  // Separate import statements (must stay at top-level of module) from the
  // rest of the user code which will be wrapped in try/catch.
  const sourceLines = typeStrippedCode.split('\n');
  const importLines: string[] = [];
  const bodyLines: string[] = [];
  for (const line of sourceLines) {
    if (/^\s*import\s/.test(line)) {
      importLines.push(line);
    } else {
      bodyLines.push(line);
    }
  }
  const importsSection = importLines.join('\n');
  const bodySection = bodyLines.join('\n');

  // Escape </script> in user code to prevent early tag closure.
  const escapeScript = (s: string) => s.replace(/<\/script>/gi, '<\\/script>');

  return `<!DOCTYPE html><html><head>
<script type="importmap">${importMapJson}</script>
</head><body>
<script>
  /* TS-5: Node.js shims — process, Buffer, require, fs, path, os, etc. */
${NODE_SHIM_JS}
  window.__cdlabDone = false;
  /* Catch module-load failures (e.g. package not on CDN, network error).
     These fire as error events before the module script body runs. */
  window.addEventListener('error', function(e) {
    if (window.__cdlabDone) return;
    window.__cdlabDone = true;
    var msg = e.message || 'Unknown error';
    var cdnMatch = (e.filename || msg).match(/esm\\.sh\\/([^?#\\s'"]+)/);
    if (cdnMatch) {
      msg = "Import Error: Cannot load package '" + cdnMatch[1] +
            "' from CDN. Check the package name or your network connection.";
    } else if (msg.indexOf('Failed to fetch') !== -1 || msg.indexOf('NetworkError') !== -1) {
      msg = "Import Error: Network failure while loading package. Check your connection.";
    }
    window.parent.postMessage({ type: 'log', payload: msg }, '*');
    window.parent.postMessage({ type: 'done' }, '*');
  });
  window.addEventListener('unhandledrejection', function(e) {
    if (window.__cdlabDone) return;
    window.__cdlabDone = true;
    var r = e.reason;
    var msg = r && r.message ? r.message : String(r);
    window.parent.postMessage({ type: 'log', payload: 'Error: ' + msg }, '*');
    window.parent.postMessage({ type: 'done' }, '*');
  });
</script>
<script type="module">
${escapeScript(importsSection)}
var _log = function() {
  var args = Array.prototype.slice.call(arguments);
  var msg = args.map(function(a) {
    try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); }
    catch(e) { return String(a); }
  }).join(' ');
  window.parent.postMessage({ type: 'log', payload: msg }, '*');
};
var console = { log: _log, warn: _log, error: _log, info: _log };
try {
${escapeScript(bodySection)}
} catch(e) {
  window.parent.postMessage({ type: 'log', payload: 'Error: ' + e.message }, '*');
}
if (!window.__cdlabDone) {
  window.__cdlabDone = true;
  window.parent.postMessage({ type: 'done' }, '*');
}
</script>
</body></html>`;
}

/**
 * TS-4 execution path: run TypeScript code that contains external npm imports.
 *
 * 1. Strips TS types (sucrase ['typescript'] only — import syntax is preserved
 *    so the importmap can resolve it).
 * 2. Builds an iframe srcdoc with importmap → esm.sh CDN entries.
 * 3. Reuses the TS-2 postMessage capture mechanism and 5-second hard timeout.
 *
 * @param source - original TypeScript source (before transpilation)
 * @param externalSpecifiers - list of npm specifiers detected in the source
 */
function runWithCdnImports(source: string, externalSpecifiers: string[]): Promise<string> {
  // Strip TS types only — keep import/export syntax for the importmap.
  let typeStripped: string;
  try {
    const r = sucraseTransform(source, { transforms: ['typescript'] });
    typeStripped = r.code;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Promise.resolve(`Transpile Error: ${msg}`);
  }

  // Also check for relative imports — these cannot be resolved in the sandbox.
  const RELATIVE_IMPORT_RE = /^\s*import(?!\s+type\b)\s+(?:[^'"]*?\s+from\s+)?['"](\.\.?\/[^'"]*)['"]/gm;
  RELATIVE_IMPORT_RE.lastIndex = 0;
  const relMatch = RELATIVE_IMPORT_RE.exec(source);
  if (relMatch) {
    return Promise.resolve(
      `Transpile Error: Cannot resolve module '${relMatch[1]}': relative imports ` +
        `are not supported in the sandbox (no file system access).`,
    );
  }

  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const lines: string[] = [];
    let doneReceived = false;
    let drainTimer: number | null = null;

    function resolveWithLines() {
      if (drainTimer !== null) clearTimeout(drainTimer);
      clearTimeout(hardTimeout);
      window.removeEventListener('message', messageHandler);
      try { document.body.removeChild(iframe); } catch { /* already removed */ }
      resolve(lines.length > 0 ? lines.join('\n') : '(no output)');
    }

    // Hard upper bound — unchanged from the eval path (TS-2).
    const hardTimeout = setTimeout(() => {
      if (drainTimer !== null) clearTimeout(drainTimer);
      window.removeEventListener('message', messageHandler);
      try { document.body.removeChild(iframe); } catch { /* already removed */ }
      resolve(
        (lines.length > 0 ? lines.join('\n') + '\n' : '') +
          '[ Execution timed out after 5 s ]',
      );
    }, 5000);

    function messageHandler(event: MessageEvent) {
      if (event.source !== iframe.contentWindow) return;
      if (event.data?.type === 'log' && typeof event.data.payload === 'string') {
        lines.push(event.data.payload);
        if (doneReceived) {
          if (drainTimer !== null) clearTimeout(drainTimer);
          drainTimer = setTimeout(resolveWithLines, 100) as unknown as number;
        }
      } else if (event.data?.type === 'done') {
        doneReceived = true;
        if (drainTimer !== null) clearTimeout(drainTimer);
        drainTimer = setTimeout(resolveWithLines, 100) as unknown as number;
      }
    }
    window.addEventListener('message', messageHandler);

    // Inject srcdoc — this triggers module loading + execution asynchronously.
    iframe.srcdoc = buildCdnSrcdoc(typeStripped, externalSpecifiers);
  });
}

/**
 * Run code inside a sandboxed iframe (browser-side execution for JS/TS).
 * Returns captured console output as a string.
 *
 * TypeScript source is transpiled to JavaScript via Sucrase before eval.
 * JavaScript source is eval'd directly (unchanged from prior behaviour).
 */
async function runInSandbox(code: string, lang: string): Promise<string> {
  if (lang === 'html') {
    // For HTML, just open in a new tab / show a preview pane approach.
    // We return a note.
    return '[ HTML preview not supported in terminal — code is shown above ]';
  }

  if (lang === 'python') {
    // Pyodide would be the right solution here but it is not installed.
    // Run a lightweight simulation so the learner gets helpful feedback.
    return runPythonSimulated(code);
  }

  // ── Language processing step (TS-1…TS-5 + JS-1) ──────────────────────────
  let executableCode = code;
  let needsExportsShim = false;

  if (lang === 'typescript' || lang === 'ts') {
    // TS-4: if the source contains external npm imports, resolve them from CDN.
    const externalSpecifiers = getExternalSpecifiers(code);
    if (externalSpecifiers.length > 0) {
      return runWithCdnImports(code, externalSpecifiers);
    }
    // TS-1 + TS-3: no external imports → transpile (type-strip + CommonJS convert).
    const result = transpileTypeScript(code);
    if ('error' in result) {
      return `Transpile Error: ${result.error}`;
    }
    executableCode = result.code;
    needsExportsShim = result.hasExports;

  } else if (lang === 'javascript' || lang === 'js') {
    // JS-1: plain JavaScript shares the CDN path (TS-4) and module syntax
    // handling (TS-3 analog) — without the TypeScript type-stripping step.
    // TS-2 (async capture) and TS-5 (Node shims) already apply to JS via the
    // shared eval context — confirmed, no extra wiring needed.

    // JS-1a: external npm imports → CDN path (same as TS-4).
    // runWithCdnImports uses sucrase ['typescript'] which is a no-op on plain JS.
    const externalSpecifiers = getExternalSpecifiers(code);
    if (externalSpecifiers.length > 0) {
      return runWithCdnImports(code, externalSpecifiers);
    }

    // JS-1b: local export/import syntax → 'imports'-only Sucrase transform.
    // processJavaScript() returns code unchanged if there is no ES module syntax.
    const result = processJavaScript(code);
    if ('error' in result) {
      return `Syntax Error: ${result.error}`;
    }
    executableCode = result.code;
    needsExportsShim = result.hasExports;
  }


  // JavaScript / TypeScript: eval inside a sandboxed iframe to capture output.
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const lines: string[] = [];
    let drainTimer: number | null = null;

    function resolveWithLines() {
      if (drainTimer) clearTimeout(drainTimer);
      cleanup();
      resolve(lines.length > 0 ? lines.join('\n') : '(no output)');
    }

    const hardTimeout = setTimeout(() => {
      cleanup();
      resolve((lines.length > 0 ? lines.join('\n') + '\n' : '') + '[ Execution timed out after 5 s ]');
    }, 5000);

    function cleanup() {
      clearTimeout(hardTimeout);
      if (drainTimer) clearTimeout(drainTimer);
      window.removeEventListener('message', messageHandler);
      try {
        document.body.removeChild(iframe);
      } catch {
        /* already removed */
      }
    }

    let doneReceived = false;
    function messageHandler(event: MessageEvent) {
      if (event.source !== iframe.contentWindow) return;
      if (event.data?.type === 'log' && typeof event.data.payload === 'string') {
        lines.push(event.data.payload);
        // If done was already signalled, each new async log resets the drain
        // window — captures chained .then() / nested setTimeout output.
        if (doneReceived) {
          if (drainTimer !== null) clearTimeout(drainTimer);
          drainTimer = setTimeout(resolveWithLines, 100) as unknown as number;
        }
      } else if (event.data?.type === 'done') {
        doneReceived = true;
        // Start the grace window; any further log messages will reset it.
        if (drainTimer !== null) clearTimeout(drainTimer);
        drainTimer = setTimeout(resolveWithLines, 100) as unknown as number;
      }
    }
    window.addEventListener('message', messageHandler);

    // Inject console shim then user code.
    // Each console.log call posts a message to the parent immediately, so
    // async callbacks (setTimeout, Promise.then, async/await) are captured.
    // A 'done' token is posted after the synchronous portion of eval finishes.
    //
    // TS-3: When the source contained export statements, sucrase's 'imports'
    // transform emits `exports.x = x`. We inject a minimal CommonJS shim so
    // these assignments don't throw ReferenceError at eval time.
    // TS-5: NODE_SHIM_JS is eval'd first to install process/Buffer/require/fs
    // stubs — must run before any user code in the iframe context.
    const exportsShim = needsExportsShim
      ? 'var exports = {}; var module = { exports: exports };'
      : '';
    // Eval the Node shim into the iframe context first (TS-5).
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (iframe.contentWindow as any).eval(NODE_SHIM_JS);
    } catch {
      /* shim install failure is non-fatal — continue with user code */
    }
    const script = `
      (function() {
        ${exportsShim}
        var _log = function() {
          var args = Array.prototype.slice.call(arguments);
          var msg = args.map(function(a) {
            try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); }
            catch(e) { return String(a); }
          }).join(' ');
          window.parent.postMessage({ type: 'log', payload: msg }, '*');
        };
        var console = { log: _log, warn: _log, error: _log, info: _log };
        try {
          ${executableCode.replace(/`/g, '\\`')}
        } catch(e) {
          window.parent.postMessage({ type: 'log', payload: 'Error: ' + e.message }, '*');
        }
        // Signal that the synchronous portion of eval is complete.
        window.parent.postMessage({ type: 'done' }, '*');
      })();
    `;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (iframe.contentWindow as any).eval(script);
      // postMessage dispatch is asynchronous even for same-origin frames —
      // do NOT read lines here. messageHandler / the drain timer handle resolution.
    } catch (e: unknown) {
      // A SyntaxError thrown synchronously by eval itself (e.g. an unhandled
      // syntax error not caught inside the IIFE) — resolve immediately.
      cleanup();
      const msg = e instanceof Error ? e.message : String(e);
      resolve(`Error: ${msg}`);
    }
  });
}

/** Very lightweight Python output simulator for basic print / arithmetic. */
function runPythonSimulated(code: string): string {
  const lines: string[] = [];
  const printRe = /print\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = printRe.exec(code)) !== null) {
    let arg = m[1].trim();
    // Strip surrounding quotes for simple string literals.
    if (
      (arg.startsWith('"') && arg.endsWith('"')) ||
      (arg.startsWith("'") && arg.endsWith("'"))
    ) {
      lines.push(arg.slice(1, -1));
    } else {
      lines.push(arg);
    }
  }
  if (lines.length === 0) return '(no output — Python requires a live runtime)';
  return (
    lines.join('\n') +
    '\n\n[ Note: Python output shown here is simulated for basic print() calls. ' +
    'For full Python execution, download your workspace and run it locally. ]'
  );
}

/**
 * Build a ZIP of all workspace files without an external library.
 * Uses the browser-native CompressionStream where available; otherwise
 * falls back to a plain uncompressed ZIP with STORED method.
 *
 * Reference: ZIP format specification (PKWare APPNOTE.TXT).
 */
async function buildZip(files: CodeLabFile[]): Promise<Blob> {
  const enc = new TextEncoder();
  const localHeaders: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  function u16le(n: number): Uint8Array {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return b;
  }
  function u32le(n: number): Uint8Array {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n, true);
    return b;
  }
  function concat(...arrays: Uint8Array[]): Uint8Array {
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(total);
    let pos = 0;
    for (const a of arrays) {
      out.set(a, pos);
      pos += a.length;
    }
    return out;
  }
  function crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  for (const file of files) {
    const data = enc.encode(file.content);
    const nameBytes = enc.encode(file.name);
    const crc = crc32(data);

    // Local file header (STORED — method 0)
    const localHeader = concat(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]), // signature
      u16le(20),           // version needed
      u16le(0),            // flags
      u16le(0),            // compression: STORED
      u16le(0),            // mod time
      u16le(0),            // mod date
      u32le(crc),          // crc-32
      u32le(data.length),  // compressed size
      u32le(data.length),  // uncompressed size
      u16le(nameBytes.length),
      u16le(0),            // extra field length
      nameBytes
    );

    // Central directory entry
    const cdEntry = concat(
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]), // signature
      u16le(20),           // version made by
      u16le(20),           // version needed
      u16le(0),            // flags
      u16le(0),            // compression: STORED
      u16le(0),            // mod time
      u16le(0),            // mod date
      u32le(crc),
      u32le(data.length),
      u32le(data.length),
      u16le(nameBytes.length),
      u16le(0),            // extra length
      u16le(0),            // comment length
      u16le(0),            // disk start
      u16le(0),            // internal attrs
      u32le(0),            // external attrs
      u32le(offset),       // local header offset
      nameBytes
    );

    localHeaders.push(concat(localHeader, data));
    centralDir.push(cdEntry);
    offset += localHeader.length + data.length;
  }

  const cdOffset = offset;
  const cdSize = centralDir.reduce((s, e) => s + e.length, 0);

  // End of central directory record
  const eocd = concat(
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]), // signature
    u16le(0),                  // disk number
    u16le(0),                  // disk with start of CD
    u16le(files.length),       // entries on this disk
    u16le(files.length),       // total entries
    u32le(cdSize),             // size of CD
    u32le(cdOffset),           // offset of CD
    u16le(0)                   // comment length
  );

  const parts: Uint8Array[] = [...localHeaders, ...centralDir, eocd];
  return new Blob([concat(...parts)], { type: 'application/zip' });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────

interface FileTabProps {
  file: CodeLabFile;
  active: boolean;
  onSelect: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  readOnly?: boolean;
}

function FileTab({ file, active, onSelect, onRename, onDelete, readOnly }: FileTabProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(file.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== file.name) onRename(trimmed);
    setEditing(false);
  };

  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-center gap-1 px-3 py-1.5 text-xs font-medium cursor-pointer select-none transition shrink-0
        ${active
          ? 'bg-background/20 text-white border-b-2 border-primary'
          : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
    >
      <FileCode2 className="h-3 w-3 shrink-0 opacity-70" />
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') { setEditing(false); setDraft(file.name); }
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-24 bg-transparent border-b border-primary outline-none text-xs"
        />
      ) : (
        <span className="max-w-[90px] truncate">{file.name}</span>
      )}
      {readOnly && <Lock className="h-2.5 w-2.5 text-yellow-400 opacity-70" />}
      {!readOnly && active && !editing && (
        <span className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true); setDraft(file.name); }}
            className="p-0.5 rounded hover:bg-white/20"
            aria-label="Rename file"
          >
            <Edit3 className="h-2.5 w-2.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-0.5 rounded hover:bg-red-500/30"
            aria-label="Delete file"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </span>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// New-file form
// ──────────────────────────────────────────────────────────────────────────

const LANGUAGE_OPTIONS = [
  { value: 'javascript', label: 'JavaScript (.js)' },
  { value: 'typescript', label: 'TypeScript (.ts)' },
  { value: 'python', label: 'Python (.py)' },
  { value: 'html', label: 'HTML (.html)' },
  { value: 'css', label: 'CSS (.css)' },
  { value: 'json', label: 'JSON (.json)' },
  { value: 'node', label: 'Node.js (template)' },
  { value: 'express', label: 'Express.js (template)' },
  { value: 'mongodb', label: 'MongoDB (template)' },
  { value: 'numpy', label: 'NumPy (template)' },
  { value: 'pandas', label: 'Pandas (template)' },
];

function defaultExtension(lang: string): string {
  const map: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    html: 'html',
    css: 'css',
    json: 'json',
    node: 'js',
    express: 'js',
    mongodb: 'js',
    numpy: 'py',
    pandas: 'py',
  };
  return map[lang] ?? 'txt';
}

interface NewFileFormProps {
  onConfirm: (name: string, language: string) => void;
  onCancel: () => void;
}

function NewFileForm({ onConfirm, onCancel }: NewFileFormProps) {
  const [lang, setLang] = useState('javascript');
  const [name, setName] = useState('');
  const [autoName, setAutoName] = useState(true);

  const derivedName = autoName
    ? `file${Date.now() % 10000}.${defaultExtension(lang)}`
    : name;

  const handleLangChange = (l: string) => {
    setLang(l);
    if (autoName) setName('');
  };

  const handleNameChange = (n: string) => {
    setAutoName(false);
    setName(n);
  };

  const submit = () => {
    const finalName = (name.trim() || `file.${defaultExtension(lang)}`);
    onConfirm(finalName, lang);
  };

  return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onCancel}
      >
        <div
          className="w-full max-w-sm rounded-xl bg-gray-900 border border-white/10 p-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-sm font-semibold text-white mb-3">New file</p>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-wide">Language</label>
              <div className="relative mt-1">
                <select
                  value={lang}
                  onChange={(e) => handleLangChange(e.target.value)}
                  className="w-full bg-white/10 text-white text-xs rounded-lg px-2 py-2 pr-6 appearance-none border border-white/10 focus:outline-none focus:border-primary"
                >
                  {LANGUAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-gray-900 text-white">
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/50 pointer-events-none" />
              </div>
              {READ_ONLY_LANGUAGES.has(lang.toLowerCase()) && (
                <p className="mt-1 text-[10px] text-amber-300/80">
                  This language ships as a read-only template — you can view the source and
                  predefined output but cannot edit or run it live.
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-wide">Filename</label>
              <input
                value={autoName ? derivedName : name}
                onChange={(e) => handleNameChange(e.target.value)}
                onFocus={() => { if (autoName) { setAutoName(false); setName(derivedName); } }}
                placeholder={`e.g. main.${defaultExtension(lang)}`}
                className="mt-1 w-full bg-white/10 text-white text-xs rounded-lg px-2 py-2 border border-white/10 focus:outline-none focus:border-primary placeholder:text-white/30"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={onCancel}
              className="flex-1 bg-white/10 text-white text-xs rounded-lg py-2 font-medium hover:bg-white/15 transition"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              className="flex-1 bg-primary text-primary-foreground text-xs rounded-lg py-2 font-medium hover:opacity-90 transition"
            >
              Create
            </button>
          </div>
        </div>
      </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Code editor area (plain textarea styled as a code editor)
// ──────────────────────────────────────────────────────────────────────────

interface CodeEditorProps {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  language?: string;
}

function CodeEditor({ value, onChange, readOnly, language }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Tab key inserts two spaces instead of moving focus.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current!;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      // Restore cursor after React re-render.
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div className="relative flex-1 min-h-0 font-mono">
      {/* Line numbers */}
      <div className="absolute left-0 top-0 bottom-0 w-10 bg-black/30 border-r border-white/5 select-none pointer-events-none overflow-hidden" aria-hidden>
        <pre className="text-[10px] text-white/20 text-right pr-1.5 pt-2 leading-[1.6] whitespace-pre">
          {value.split('\n').map((_, i) => `${i + 1}\n`).join('')}
        </pre>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        readOnly={readOnly}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        data-language={language}
        className={`absolute inset-0 pl-11 pr-2 pt-2 pb-2 bg-transparent text-green-300 text-xs leading-[1.6] font-mono resize-none outline-none w-full h-full overflow-auto
          ${readOnly ? 'cursor-default opacity-80' : 'cursor-text'}
          selection:bg-primary/30`}
        style={{ caretColor: '#22c55e', tabSize: 2 }}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Terminal output pane
// ──────────────────────────────────────────────────────────────────────────

interface TerminalPaneProps {
  output: string;
  isRunning: boolean;
}

function TerminalPane({ output, isRunning }: TerminalPaneProps) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  return (
    <div className="flex flex-col h-full bg-black/60 border-t border-white/10">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 border-b border-white/5 shrink-0">
        <Terminal className="h-3 w-3 text-green-400" />
        <span className="text-[10px] text-white/50 font-mono uppercase tracking-wide">Output</span>
        {isRunning && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-yellow-400">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
            Running…
          </span>
        )}
      </div>
      <div className="flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-green-300 whitespace-pre-wrap">
        {output || <span className="text-white/20">No output yet. Press ▶ Run to execute.</span>}
        <div ref={endRef} />
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Empty-state template gallery — shown when the workspace has no files yet.
// Lets the learner browse the read-only templates (MongoDB, Node.js, etc.)
// from product.md §6.20 without first having to open the New File dialog.
// ──────────────────────────────────────────────────────────────────────────

interface TemplateGalleryProps {
  onPick: (template: Template) => void;
}

function TemplateGallery({ onPick }: TemplateGalleryProps) {
  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs uppercase tracking-wide text-white/50 mb-1">Read-only templates</p>
        <p className="text-[11px] text-white/40 mb-4">
          These languages don't run inside CodeLab — pick one to see a worked example with its
          expected output. Pick anything else from the <span className="text-white/60">+</span> button
          to write and run your own code.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {READ_ONLY_TEMPLATES.map((t) => (
            <button
              key={t.language}
              onClick={() => onPick(t)}
              className="text-left rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition px-3 py-2 group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white">{t.label}</span>
                <Lock className="h-3.5 w-3.5 text-white/40 group-hover:text-white/70 transition" />
              </div>
              <p className="text-[10px] text-white/40 font-mono">{t.filename}</p>
              <p className="text-[11px] text-white/50 mt-1.5 line-clamp-2 font-mono whitespace-pre-wrap">
                {t.source.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('#')).slice(0, 2).join(' / ')}
              </p>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-white/30 mt-4 text-center">
          Pick a template above to open it, or use <span className="text-white/60">+</span> to write your own.
        </p>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Main CodeLab panel
// ──────────────────────────────────────────────────────────────────────────

interface CodeLabProps {
  userId: string;
  /** Render the video child on the right side. */
  videoSlot: React.ReactNode;
  /** Close CodeLab — parent will resume video. */
  onClose: () => void;
}

export function CodeLab({ userId, videoSlot, onClose }: CodeLabProps) {
  const store = useCodeLabStore();
  const files = store.getFiles(userId);
  const activeFileId = store.getActiveFileId(userId);
  const activeFile = files.find((f) => f.id === activeFileId) ?? files[0] ?? null;

  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [showNewFileForm, setShowNewFileForm] = useState(false);
  const [limitMsg, setLimitMsg] = useState<string | null>(null);

  // Determine if the active file is read-only (template language).
  const isReadOnly = activeFile ? languageIsReadOnly(activeFile.language) : false;
  const template = activeFile ? getTemplate(activeFile.language) : null;

  // When switching to a read-only template file that is empty, populate it.
  useEffect(() => {
    if (activeFile && template && activeFile.content === '') {
      store.updateFile(userId, activeFile.id, template.source);
      setOutput(template.output);
    } else if (activeFile && template) {
      // Already has content — just show the predefined output.
      setOutput(template.output);
    } else {
      // Switching to a runnable file — clear stale template output.
      // (Don't clear output for runnable files that have been run.)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFileId]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleRun = useCallback(async () => {
    if (!activeFile) return;
    if (isReadOnly) {
      // Show predefined output for template.
      setOutput(template?.output ?? '(predefined output)');
      return;
    }
    setIsRunning(true);
    setOutput('');
    try {
      const result = await runInSandbox(activeFile.content, activeFile.language);
      setOutput(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setOutput(`Error: ${msg}`);
    } finally {
      setIsRunning(false);
    }
  }, [activeFile, isReadOnly, template]);

  const handleEditorChange = useCallback(
    (content: string) => {
      if (!activeFile || isReadOnly) return;
      const err = store.updateFile(userId, activeFile.id, content);
      if (err) toast.error(err);
    },
    [activeFile, isReadOnly, store, userId]
  );

  const handleCreateFile = useCallback(
    (name: string, language: string) => {
      setShowNewFileForm(false);
      const err = store.createFile(userId, name, language);
      if (err) {
        setLimitMsg(err);
      } else {
        setLimitMsg(null);
        setOutput('');
      }
    },
    [store, userId]
  );

  const handleDownload = useCallback(async () => {
    const zip = await buildZip(files);
    downloadBlob(zip, 'codelab-workspace.zip');
    toast.success('Workspace downloaded as ZIP');
  }, [files]);

  const handleReset = useCallback(async () => {
    // Per product.md: always download first, then clear.
    const zip = await buildZip(files);
    downloadBlob(zip, 'codelab-workspace.zip');
    setTimeout(() => {
      store.resetWorkspace(userId);
      setOutput('');
      setLimitMsg(null);
      toast.info('Workspace reset — your files were downloaded as a ZIP first.');
    }, 300);
  }, [files, store, userId]);

  const handleDeleteFile = useCallback(
    (fileId: string) => {
      store.deleteFile(userId, fileId);
      setOutput('');
    },
    [store, userId]
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-40 flex bg-gray-950">
      {/* ── Main split-screen ─────────────────────────────────────── */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* ── LEFT: Editor + Terminal ─────────────────────────── */}
        <ResizablePanel defaultSize={70} minSize={25} maxSize={75} className="flex flex-col bg-gray-950 min-h-0">
          {/* Tab bar */}
          <div className="relative flex items-center bg-black/50 border-b border-white/10 min-h-[36px] overflow-x-auto shrink-0">
            {files.map((f) => (
              <FileTab
                key={f.id}
                file={f}
                active={f.id === activeFileId}
                onSelect={() => { store.setActiveFile(userId, f.id); setOutput(''); }}
                onRename={(name) => store.renameFile(userId, f.id, name)}
                onDelete={() => handleDeleteFile(f.id)}
                readOnly={languageIsReadOnly(f.language)}
              />
            ))}

            {/* New file button */}
            {files.length < MAX_FILES && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowNewFileForm((s) => !s)}
                    className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/10 transition"
                    aria-label="New file"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>New file</TooltipContent>
              </Tooltip>
            )}

            {/* Workspace actions */}
            <div className="ml-auto flex items-center gap-1 px-2 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleDownload}
                    className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] text-white/50 hover:text-white hover:bg-white/10 transition"
                    aria-label="Download workspace as ZIP"
                  >
                    <Download className="h-3 w-3" />
                    <span className="hidden sm:inline">Download</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Download workspace as ZIP</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleReset}
                    className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] text-white/50 hover:text-red-400 hover:bg-red-500/10 transition"
                    aria-label="Reset workspace (downloads first)"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Reset workspace (downloads ZIP first)</TooltipContent>
              </Tooltip>

              {/* Close CodeLab */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onClose}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 hover:text-white hover:bg-white/10 transition"
                    aria-label="Close CodeLab"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Close CodeLab (resumes video)</TooltipContent>
              </Tooltip>
            </div>

            {/* New file popover */}
            {showNewFileForm && (
              <NewFileForm
                onConfirm={handleCreateFile}
                onCancel={() => setShowNewFileForm(false)}
              />
            )}
          </div>

          {/* File limit warning */}
          {limitMsg && (
            <div className="bg-amber-900/60 border-b border-amber-500/30 px-3 py-2 text-xs text-amber-200 flex items-start gap-2 shrink-0">
              <span className="mt-0.5 shrink-0">⚠️</span>
              <div className="flex-1">
                {limitMsg}
                <div className="flex gap-2 mt-1.5">
                  <button
                    onClick={handleDownload}
                    className="underline underline-offset-2 hover:no-underline"
                  >
                    Download Workspace
                  </button>
                  <span className="text-amber-400">→ then →</span>
                  <button
                    onClick={handleReset}
                    className="underline underline-offset-2 hover:no-underline"
                  >
                    Reset Workspace
                  </button>
                </div>
              </div>
              <button onClick={() => setLimitMsg(null)} className="text-amber-400 hover:text-white shrink-0">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Read-only banner */}
          {isReadOnly && activeFile && (
            <div className="flex items-center gap-2 bg-yellow-900/40 border-b border-yellow-500/20 px-3 py-1.5 text-[10px] text-yellow-300 shrink-0">
              <Lock className="h-3 w-3 shrink-0" />
              <span>
                <strong>{activeFile.language.charAt(0).toUpperCase() + activeFile.language.slice(1)}</strong> requires a live
                runtime that isn't available here. This is a read-only example with predefined output.
              </span>
            </div>
          )}

          {/* Editor area */}
          <div className="flex flex-col flex-1 min-h-0">
            {/* Toolbar */}
            <div className="flex items-center px-3 py-1.5 bg-black/30 border-b border-white/5 shrink-0">
              <span className="text-[10px] text-white/30 font-mono">
                {activeFile?.name ?? 'No file'}
                {isReadOnly && ' · read-only'}
              </span>
              <div className="ml-auto">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleRun}
                      disabled={isRunning || !activeFile}
                      className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-[11px] font-semibold px-3 py-1 rounded-md transition"
                      aria-label="Run code"
                    >
                      <Play className="h-3 w-3" />
                      {isReadOnly ? 'Show Output' : 'Run'}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isReadOnly ? 'Show predefined output' : 'Run code (Ctrl+Enter)'}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Split: editor top, terminal bottom */}
            <ResizablePanelGroup direction="vertical" className="flex-1 min-h-0">
              <ResizablePanel defaultSize={65} minSize={20} className="flex flex-col min-h-0 overflow-hidden">
                {activeFile ? (
                  <CodeEditor
                    value={activeFile.content}
                    onChange={handleEditorChange}
                    readOnly={isReadOnly}
                    language={activeFile.language}
                  />
                ) : files.length === 0 ? (
                  <TemplateGallery onPick={(template) => {
                    if (files.length >= MAX_FILES) {
                      setLimitMsg(`Workspace limit reached (${MAX_FILES} files). Download and Reset your workspace to continue.`);
                      return;
                    }
                    store.createFile(userId, template.filename, template.language);
                    setOutput(template.output);
                    setShowNewFileForm(false);
                  }} />
                ) : (
                  <div className="flex-1 flex items-center justify-center text-white/20 text-xs">
                    No file selected
                  </div>
                )}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={35} minSize={15} className="flex flex-col min-h-0">
                <TerminalPane output={output} isRunning={isRunning} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </ResizablePanel>

        {/* ── Divider ─────────────────────────────────────────── */}
        <ResizableHandle withHandle className="w-1.5 bg-white/5 hover:bg-primary/40 transition-colors" />

        {/* ── RIGHT: Paused video ──────────────────────────────── */}
        <ResizablePanel defaultSize={30} minSize={25} maxSize={75} className="flex flex-col bg-black">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 border-b border-white/5 shrink-0">
            <span className="text-[10px] text-white/40 uppercase tracking-wide">Paused lecture</span>
            <span className="ml-auto text-[10px] text-white/25">Close CodeLab to resume</span>
          </div>
          {/*
            CSS transform trick: the video component uses `fixed inset-0` in focusMode.
            A CSS transform on an ancestor causes `position: fixed` children to be
            positioned relative to that ancestor instead of the viewport — effectively
            containing the video within this panel.
          */}
          <div
            className="flex-1 min-h-0 overflow-hidden relative"
            style={{ transform: 'translateZ(0)' }}
          >
            {videoSlot}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export default CodeLab;
