import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const idx = line.indexOf('=');
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function findFilesRecursively(rootDir, targetFileName) {
  const matches = [];

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name === targetFileName) {
        matches.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return matches;
}

function getLatestFailureDirectory(testResultsDir) {
  if (!fs.existsSync(testResultsDir)) {
    throw new Error(`test-results folder not found: ${testResultsDir}`);
  }

  const errorContextFiles = findFilesRecursively(testResultsDir, 'error-context.md');
  if (errorContextFiles.length === 0) {
    throw new Error('No failure artifacts found (error-context.md not found). Run a failing test first.');
  }

  const sorted = errorContextFiles
    .map((filePath) => ({
      filePath,
      mtimeMs: fs.statSync(filePath).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return path.dirname(sorted[0].filePath);
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // continue
    }
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }

  return null;
}

function getFirstExisting(paths) {
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function main() {
  loadDotEnv(path.resolve('.env'));

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing. Add it in e2e/.env and rerun.');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const testResultsDir = path.resolve('test-results');

  const explicitRunDir = process.argv[2] ? path.resolve(process.argv[2]) : null;
  const runDir = explicitRunDir || getLatestFailureDirectory(testResultsDir);

  const errorContextPath = path.join(runDir, 'error-context.md');
  if (!fs.existsSync(errorContextPath)) {
    throw new Error(`error-context.md not found in: ${runDir}`);
  }

  const screenshotPath = getFirstExisting([
    path.join(runDir, 'test-failed-1.png'),
    path.join(runDir, 'screenshot.png'),
  ]);

  const tracePath = getFirstExisting([path.join(runDir, 'trace.zip')]);

  const errorContext = fs.readFileSync(errorContextPath, 'utf8');
  const screenshotBase64 = screenshotPath
    ? fs.readFileSync(screenshotPath).toString('base64')
    : null;

  const ai = new GoogleGenAI({ apiKey });

  const prompt = [
    'Analyze this Playwright E2E failure and return STRICT JSON only.',
    'Use screenshot and error-context as evidence. Do not add markdown.',
    '',
    'Required JSON schema:',
    '{',
    '  "title": "string",',
    '  "severity": "critical|high|medium|low",',
    '  "confidence": 0.0,',
    '  "rootCause": "string",',
    '  "reproSteps": ["string"],',
    '  "expectedBehavior": "string",',
    '  "actualBehavior": "string",',
    '  "suggestedFixes": ["string"],',
    '  "flakySignals": ["string"],',
    '  "evidence": ["string"]',
    '}',
    '',
    `Run directory: ${runDir}`,
    `Trace file present: ${Boolean(tracePath)}`,
    '',
    'Error context:',
    errorContext.slice(0, 35000),
  ].join('\n');

  const parts = [{ text: prompt }];

  if (screenshotBase64) {
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: screenshotBase64,
      },
    });
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts }],
    config: {
      temperature: 0.2,
    },
  });

  const responseText = response.text || '';
  const parsed = tryParseJson(responseText);

  const report = {
    generatedAt: new Date().toISOString(),
    model,
    runDir,
    files: {
      errorContextPath,
      screenshotPath,
      tracePath,
    },
    analysis: parsed || {
      parseError: 'Model response was not valid JSON.',
      rawResponse: responseText,
    },
  };

  const outPath = path.join(testResultsDir, 'gemini-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('Gemini analysis complete.');
  console.log(`Report: ${outPath}`);
  if (parsed?.title) {
    console.log(`Title: ${parsed.title}`);
  }
  if (parsed?.severity) {
    console.log(`Severity: ${parsed.severity}`);
  }
}

main().catch((error) => {
  console.error('Gemini analysis failed:', error.message || error);
  process.exit(1);
});
