/**
 * Transcript helpers for the Smart Bloom direct path.
 *
 * Every transcript source (YouTube captions, an uploaded .srt or .vtt file) is
 * reduced to the same chunk shape the Smart Bloom page already reads:
 * `{chunks: [{timestamp: [startSeconds, endSeconds], text}]}`.
 */

export interface ITranscriptChunk {
  timestamp: [number, number];
  text: string;
}

export interface ITranscript {
  chunks: ITranscriptChunk[];
}

/** "HH:MM:SS,mmm", "MM:SS.mmm" or "SS.mmm" to seconds; null when unreadable. */
export function parseCueTime(value: string): number | null {
  const parts = value.trim().replace(',', '.').split(':');
  if (parts.length < 1 || parts.length > 3) return null;
  let seconds = 0;
  for (const part of parts) {
    if (!/^\d+(\.\d+)?$/.test(part)) return null;
    seconds = seconds * 60 + Number(part);
  }
  return seconds;
}

const CUE_TIMING = /^\s*([\d:.,]+)\s*-->\s*([\d:.,]+)/;

/** Formatting tags that are removed without inserting a space. */
const INLINE_TAGS = new Set([
  'i',
  'b',
  'u',
  'c',
  'em',
  'strong',
  'span',
  'font',
  'ruby',
  'rt',
]);

/** Longest tag that stripMarkup will remove; anything longer is left as text. */
const MAX_TAG_LENGTH = 200;

/**
 * Remove markup tags such as <v Speaker>, <i>, </c> or <00:00:01.000>. Tags
 * that separate words become a space; inline formatting tags just disappear. A tag must start right after "<" with a letter, digit or
 * "/", so speech like "if a < b" is kept. Scans once and looks at most
 * MAX_TAG_LENGTH characters ahead of each "<", so the cost stays linear on any
 * input (a regex like /<[^>]+>/g is quadratic on text full of unclosed "<").
 */
export function stripMarkup(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const lt = text.indexOf('<', i);
    if (lt === -1) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, lt);
    const window = text.slice(lt + 1, lt + 1 + MAX_TAG_LENGTH);
    const gt = window.indexOf('>');
    const innerLt = window.indexOf('<');
    const startsLikeTag = /^[A-Za-z0-9/]/.test(window);
    if (startsLikeTag && gt !== -1 && (innerLt === -1 || gt < innerLt)) {
      // Inline formatting (<i>, </b>, <c.yellow>) sits inside words; others separate them.
      const name = window.slice(0, gt).split(/[\s.]/)[0].toLowerCase();
      out += name.startsWith('/') || INLINE_TAGS.has(name) ? '' : ' ';
      i = lt + 2 + gt;
    } else {
      out += '<';
      i = lt + 1;
    }
  }
  return out;
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Collapse all whitespace runs to single spaces, without a trailing-anchor regex. */
export function collapseSpaces(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(' ');
}

function cleanCueText(lines: string[]): string {
  const withoutStyling = lines.join(' ').replace(/\{\\[^}]{0,100}\}/g, ''); // SRT styling overrides such as {\an8}
  return collapseSpaces(decodeEntities(stripMarkup(withoutStyling)));
}

/**
 * Parse SRT or WebVTT text. Both are blocks of "start --> end" plus text lines,
 * separated by blank lines; cue numbers, the WEBVTT header, NOTE and STYLE
 * blocks carry no timing and are skipped.
 */
export function parseTimedTextFile(content: string): ITranscriptChunk[] {
  const blocks = String(content ?? '')
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/);

  const chunks: ITranscriptChunk[] = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const timingIndex = lines.findIndex(line => CUE_TIMING.test(line));
    if (timingIndex === -1) continue;

    const [, startRaw, endRaw] = lines[timingIndex].match(CUE_TIMING)!;
    const start = parseCueTime(startRaw);
    const end = parseCueTime(endRaw);
    if (start === null || end === null || end < start) continue;

    const text = cleanCueText(lines.slice(timingIndex + 1));
    if (!text) continue;
    chunks.push({timestamp: [start, end], text});
  }
  return mergeRollingDuplicates(chunks);
}

/**
 * Auto-generated captions often repeat the previous line as the next cue begins
 * (the "rolling" style). Drop a cue whose text is already the tail of the one
 * before it, so the transcript does not say everything twice.
 */
export function mergeRollingDuplicates(
  chunks: ITranscriptChunk[],
): ITranscriptChunk[] {
  const out: ITranscriptChunk[] = [];
  for (const chunk of chunks) {
    const previous = out[out.length - 1];
    if (previous && previous.text.endsWith(chunk.text)) {
      previous.timestamp[1] = Math.max(
        previous.timestamp[1],
        chunk.timestamp[1],
      );
      continue;
    }
    out.push({
      timestamp: [chunk.timestamp[0], chunk.timestamp[1]],
      text: chunk.text,
    });
  }
  return out;
}

/** YouTube's json3 caption format: events with tStartMs, dDurationMs and text segs. */
export function json3ToChunks(json3: any): ITranscriptChunk[] {
  const events: any[] = Array.isArray(json3?.events) ? json3.events : [];
  const chunks: ITranscriptChunk[] = [];
  for (const event of events) {
    if (!Array.isArray(event?.segs)) continue;
    const text = event.segs
      .map((seg: any) => String(seg?.utf8 ?? ''))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) continue;
    const start = Number(event.tStartMs ?? 0) / 1000;
    const end = start + Number(event.dDurationMs ?? 0) / 1000;
    chunks.push({timestamp: [round2(start), round2(end)], text});
  }
  return mergeRollingDuplicates(chunks);
}

export function transcriptEndTime(chunks: ITranscriptChunk[]): number {
  return chunks.reduce(
    (max, chunk) => Math.max(max, chunk.timestamp[1], chunk.timestamp[0]),
    0,
  );
}

/** Text spoken in [start, end), taken from every chunk that starts in the window. */
export function textInWindow(
  chunks: ITranscriptChunk[],
  start: number,
  end: number,
): string {
  return chunks
    .filter(chunk => chunk.timestamp[0] >= start && chunk.timestamp[0] < end)
    .map(chunk => chunk.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compact timestamped rendering for a model to read: one "[mm:ss] text" line
 * per chunk, merged into roughly `lineSeconds` lines to keep prompts small.
 */
export function renderTimestampedTranscript(
  chunks: ITranscriptChunk[],
  lineSeconds = 20,
): string {
  const lines: string[] = [];
  let lineStart: number | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (lineStart !== null && buffer.length) {
      lines.push(`[${Math.round(lineStart)}s] ${buffer.join(' ')}`);
    }
    lineStart = null;
    buffer = [];
  };
  for (const chunk of chunks) {
    if (lineStart === null) lineStart = chunk.timestamp[0];
    buffer.push(chunk.text);
    if (chunk.timestamp[0] - lineStart >= lineSeconds) flush();
  }
  flush();
  return lines.join('\n');
}

/**
 * Turn proposed boundary times into a valid segment map: segment END times,
 * strictly increasing, no segment shorter than `minSegmentSeconds` where the
 * video is long enough to allow it, and the last boundary at `endTime` so the
 * final segment reaches the end of the video.
 */
export function normalizeSegmentMap(
  proposed: unknown[],
  endTime: number,
  minSegmentSeconds: number,
): number[] {
  const end = round2(endTime);
  if (!(end > 0)) return [];

  const sorted = proposed
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && value > 0 && value < end)
    .sort((a, b) => a - b);

  const boundaries: number[] = [];
  let previous = 0;
  for (const value of sorted) {
    if (value - previous < minSegmentSeconds) continue;
    if (end - value < minSegmentSeconds) continue; // would leave a too-short tail
    boundaries.push(round2(value));
    previous = value;
  }
  boundaries.push(end);
  return boundaries;
}

/** Evenly spaced fallback boundaries when the model's answer is unusable. */
export function evenSegmentMap(
  endTime: number,
  targetSegmentSeconds: number,
): number[] {
  const end = round2(endTime);
  if (!(end > 0)) return [];
  const count = Math.max(
    1,
    Math.round(end / Math.max(1, targetSegmentSeconds)),
  );
  const step = end / count;
  return Array.from({length: count}, (_, i) =>
    i === count - 1 ? end : round2(step * (i + 1)),
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
