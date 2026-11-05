/**
 * Turn a transcript in whatever form an instructor has into Smart Bloom chunks.
 *
 * Instructors rarely have a clean .srt file. They have YouTube's "Show transcript"
 * text copied from the page, Zoom/Teams/Otter exports, Word documents, CSV rows,
 * or JSON from a transcription tool. The only thing Smart Bloom truly needs is
 * timestamps, so this reads any text that contains them:
 *
 *   1. JSON with a recognisable list of timed entries.
 *   2. SRT / WebVTT ("start --> end" cue blocks).
 *   3. Anything else: every timestamp starts a new line of speech, and the text
 *      up to the next timestamp belongs to it. Ranges such as "0:05 - 0:09" or
 *      SBV's "0:00:05.000,0:00:09.000" set both ends.
 *
 * Numbers that only look like times ("verse 3:16", "a 1:2 ratio") are dropped by
 * keeping the longest run of timestamps that never goes backwards.
 */
import {
  ITranscriptChunk,
  collapseSpaces,
  decodeEntities,
  json3ToChunks,
  mergeRollingDuplicates,
  parseTimedTextFile,
  stripMarkup,
} from './Transcript.js';

export class TranscriptFormatError extends Error {}

/** Speaking rate used to guess how long the last line lasts when nothing says. */
const WORDS_PER_SECOND = 2.5;

export function parseAnyTranscript(content: string): ITranscriptChunk[] {
  const text = String(content ?? '')
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .trim();
  if (!text) throw new TranscriptFormatError('The transcript is empty.');

  const fromJson = tryJson(text);
  if (fromJson && fromJson.length) return finish(fromJson);

  // Proper SRT/VTT: trust the cue parser only if it found (nearly) every cue.
  // Word exports of Teams transcripts lose the blank lines between cues, which
  // turns the file into one block; the general reader below handles that.
  // Counted with split, not a regex: this counts cue timing arrows, it is not HTML handling.
  const arrows = text.split('-->').length - 1;
  if (arrows) {
    const cues = parseTimedTextFile(text);
    if (cues.length && cues.length >= arrows * 0.8) return cues;
  }

  const generic = parseTimestampedText(text);
  if (generic.length >= 2) return finish(generic);

  throw new TranscriptFormatError(
    'No timestamps were found in this transcript. Smart Bloom needs times such as 0:05 or 00:01:23 next to the text so the video can be split into segments.',
  );
}

// ── JSON ──────────────────────────────────────────────────────────────────────

const START_KEYS = [
  'start',
  'startTime',
  'start_time',
  'startSeconds',
  'begin',
  'from',
  'offset',
  'time',
  'tStartMs',
];
const END_KEYS = ['end', 'endTime', 'end_time', 'endSeconds', 'to', 'stop'];
const DURATION_KEYS = ['duration', 'dur', 'dDurationMs'];
const TEXT_KEYS = [
  'text',
  'content',
  'caption',
  'transcript',
  'utterance',
  'sentence',
  'words',
];

function tryJson(text: string): ITranscriptChunk[] | null {
  if (!/^[[{]/.test(text)) return null;
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }

  if (Array.isArray(data?.events)) return json3ToChunks(data);
  if (
    Array.isArray(data?.chunks) &&
    data.chunks.every((c: any) => Array.isArray(c?.timestamp))
  ) {
    return data.chunks
      .map((c: any) => ({
        timestamp: [toSeconds(c.timestamp[0]), toSeconds(c.timestamp[1])] as [
          number,
          number,
        ],
        text: cleanText(String(c.text ?? '')),
      }))
      .filter(
        (c: ITranscriptChunk) => Number.isFinite(c.timestamp[0]) && c.text,
      );
  }

  const list: any[] | null = Array.isArray(data)
    ? data
    : ([
        'segments',
        'results',
        'items',
        'captions',
        'transcript',
        'utterances',
        'cues',
      ]
        .map(k => data?.[k])
        .find(Array.isArray) ?? null);
  if (!list?.length) return null;

  const pick = (item: any, keys: string[]) =>
    keys.map(k => item?.[k]).find(v => v !== undefined && v !== null);
  const rawStarts = list.map(item => pick(item, START_KEYS));
  // Millisecond fields: named so, or values too large to be seconds of a lecture.
  const inMs =
    list.some(
      item => item?.tStartMs !== undefined || item?.startMs !== undefined,
    ) || rawStarts.some(v => typeof v === 'number' && v > 100_000);
  const scale = (v: any) =>
    typeof v === 'number' && inMs ? v / 1000 : toSeconds(v);

  const chunks: ITranscriptChunk[] = [];
  for (const item of list) {
    const start = scale(pick(item, START_KEYS));
    const rawText = pick(item, TEXT_KEYS);
    const words = Array.isArray(rawText)
      ? rawText.map((w: any) => w?.word ?? w?.text ?? w).join(' ')
      : rawText;
    const text = cleanText(String(words ?? ''));
    if (!Number.isFinite(start) || !text) continue;
    let end = scale(pick(item, END_KEYS));
    if (!Number.isFinite(end)) {
      const duration = scale(pick(item, DURATION_KEYS));
      end = Number.isFinite(duration) ? start + duration : NaN;
    }
    chunks.push({timestamp: [start, end], text});
  }
  return chunks;
}

// ── Timestamps anywhere in text ───────────────────────────────────────────────

/**
 * h:mm:ss, m:ss or mm:ss, optional .mmm or ,mmm fraction; Teams writes single
 * digits (0:0:3.320), so each field accepts one or two digits (minutes up to three).
 * Not preceded by a digit, colon or dot, and not followed by a digit or colon.
 */
const TIMESTAMP =
  /(?<![\d:.])(?:(\d{1,2}):)?(\d{1,3}):(\d{1,2})(?:[.,](\d{1,3}))?(?![\d:])/g;
const CLOCK_SUFFIX = /^\s*(?:a\.?m\.?|p\.?m\.?)(?![a-z])/i;
/** What may sit between the two times of a range: "0:05 --> 0:09", "0:05 - 0:09", SBV's "0:05,0:09". */
const RANGE_JOINERS = new Set(['-->', '->', '-', '–', '—', 'to', ',']);

function isRangeJoiner(between: string): boolean {
  return (
    between.length <= 12 && RANGE_JOINERS.has(between.trim().toLowerCase())
  );
}

interface IMarker {
  index: number; // where the marker starts in the text
  endIndex: number; // where the marker (and any range end) finishes
  cutIndex: number; // where the previous line's text stops (before a same-line label)
  structural: boolean; // at the start or end of its line, as real transcript timestamps are
  start: number;
  end?: number;
}

/** Position facts about a marker spanning [index, endIndex) in `text`. */
function placement(text: string, index: number, endIndex: number) {
  const lineStart = text.lastIndexOf('\n', index - 1) + 1;
  const lineEndRaw = text.indexOf('\n', endIndex);
  const lineEnd = lineEndRaw === -1 ? text.length : lineEndRaw;
  const before = text.slice(lineStart, index);
  const after = text.slice(endIndex, lineEnd);
  const atStart = /^[\s[(]*$/.test(before);
  const atEnd = /^[\s\])]*$/.test(after);
  // "Speaker 2   0:10" puts a label before the time: the previous line ends before it.
  return {
    structural: atStart || atEnd,
    cutIndex: atStart ? index : atEnd ? lineStart : index,
  };
}

function matchSeconds(match: RegExpExecArray): number {
  const [, hours, minutes, seconds, fraction] = match;
  const frac = fraction ? Number(`0.${fraction}`) : 0;
  return (
    Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(seconds) + frac
  );
}

export function parseTimestampedText(text: string): ITranscriptChunk[] {
  const found: Array<{index: number; endIndex: number; seconds: number}> = [];
  for (const match of text.matchAll(TIMESTAMP)) {
    const endIndex = match.index! + match[0].length;
    if (CLOCK_SUFFIX.test(text.slice(endIndex, endIndex + 6))) continue; // "10:30 am" is a clock time
    if (
      Number(match[3]) > 59 ||
      (match[1] !== undefined && Number(match[2]) > 59)
    )
      continue;
    found.push({
      index: match.index!,
      endIndex,
      seconds: matchSeconds(match as RegExpExecArray),
    });
  }

  // Pair "start <joiner> end" into one marker.
  const markers: IMarker[] = [];
  for (let i = 0; i < found.length; i++) {
    const current = found[i];
    const next = found[i + 1];
    if (
      next &&
      isRangeJoiner(text.slice(current.endIndex, next.index)) &&
      next.seconds >= current.seconds
    ) {
      markers.push({
        index: current.index,
        endIndex: next.endIndex,
        ...placement(text, current.index, next.endIndex),
        start: current.seconds,
        end: next.seconds,
      });
      i++;
    } else {
      markers.push({
        index: current.index,
        endIndex: current.endIndex,
        ...placement(text, current.index, current.endIndex),
        start: current.seconds,
      });
    }
  }

  // In every real transcript layout the timestamps sit at the start or end of a
  // line. When most do, a time mentioned mid-sentence is speech, not a marker.
  const structural = markers.filter(m => m.structural);
  const candidates =
    structural.length >= markers.length * 0.6 ? structural : markers;
  const kept = longestNonDecreasing(candidates);
  const chunks: ITranscriptChunk[] = [];
  for (let i = 0; i < kept.length; i++) {
    const marker = kept[i];
    const following = kept[i + 1];
    const body = cleanText(
      text.slice(
        marker.endIndex,
        following ? Math.max(marker.endIndex, following.cutIndex) : text.length,
      ),
    );
    if (!body) continue;
    const end = marker.end ?? following?.start ?? NaN;
    chunks.push({timestamp: [marker.start, end], text: body});
  }
  return chunks;
}

/** Keep the largest set of markers whose times never decrease, in text order. */
function longestNonDecreasing(markers: IMarker[]): IMarker[] {
  if (markers.length < 2) return markers;
  const tails: number[] = []; // index into markers of the smallest tail for each length
  const previous: number[] = new Array(markers.length).fill(-1);
  for (let i = 0; i < markers.length; i++) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (markers[tails[mid]].start <= markers[i].start) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) previous[i] = tails[lo - 1];
    tails[lo] = i;
  }
  const out: IMarker[] = [];
  for (let i = tails[tails.length - 1]; i !== -1; i = previous[i])
    out.push(markers[i]);
  return out.reverse();
}

// ── Shared cleanup ────────────────────────────────────────────────────────────

/** Characters left around a line's text once its timestamp is removed. */
const EDGE_SEPARATORS = new Set([
  ' ',
  '"',
  "'",
  ',',
  ';',
  '|',
  ':',
  '-',
  '–',
  '—',
]);

/**
 * Tidy the text that belongs to one timestamp. Works line by line and trims with
 * plain loops: anchored regexes such as /^\s*\d+\s*$/gm or /[\s,]+$/ take
 * quadratic time on crafted input, and this runs on request bodies of up to 5 MB.
 */
function cleanText(raw: string): string {
  const lines = decodeEntities(stripMarkup(raw))
    .split('\n')
    .map(line => line.trim())
    .filter(
      line =>
        line &&
        !/^\d{1,6}$/.test(line) && // lone cue numbers
        !line.toUpperCase().startsWith('WEBVTT') &&
        !isSpokenDuration(line),
    );
  const text = collapseSpaces(lines.join(' '))
    .split(' ')
    .filter(word => word !== '[]' && word !== '()') // brackets emptied by removing a timestamp
    .join(' ');
  return trimEdges(text);
}

/** YouTube's transcript panel adds a spoken-out time ("2 minutes, 5 seconds") under each timestamp. */
function isSpokenDuration(line: string): boolean {
  if (line.length > 60) return false;
  const tokens = line
    .toLowerCase()
    .replace(/,/g, ' ')
    .split(' ')
    .filter(Boolean);
  if (!tokens.length || tokens.length % 2 !== 0) return false;
  for (let i = 0; i < tokens.length; i += 2) {
    if (
      !/^\d{1,5}$/.test(tokens[i]) ||
      !/^(hours?|minutes?|seconds?)$/.test(tokens[i + 1])
    ) {
      return false;
    }
  }
  return true;
}

function trimEdges(text: string): string {
  let start = 0;
  let end = text.length;
  while (
    start < end &&
    (EDGE_SEPARATORS.has(text[start]) ||
      text[start] === ']' ||
      text[start] === ')')
  )
    start++;
  while (
    end > start &&
    (EDGE_SEPARATORS.has(text[end - 1]) ||
      text[end - 1] === '[' ||
      text[end - 1] === '(')
  )
    end--;
  return text.slice(start, end);
}

function toSeconds(value: unknown): number {
  if (typeof value === 'number') return value;
  const text = String(value ?? '').trim();
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  const match = new RegExp(TIMESTAMP.source).exec(text);
  return match ? matchSeconds(match) : NaN;
}

/** Sort, fill missing end times from the next start, and drop rolling repeats. */
function finish(chunks: ITranscriptChunk[]): ITranscriptChunk[] {
  const sorted = chunks
    .filter(
      c => Number.isFinite(c.timestamp[0]) && c.timestamp[0] >= 0 && c.text,
    )
    .sort((a, b) => a.timestamp[0] - b.timestamp[0]);
  for (let i = 0; i < sorted.length; i++) {
    const [start, end] = sorted[i].timestamp;
    const nextStart = sorted[i + 1]?.timestamp[0];
    let fixedEnd = end;
    if (!Number.isFinite(fixedEnd) || fixedEnd < start) {
      fixedEnd = Number.isFinite(nextStart)
        ? nextStart
        : start +
          Math.max(2, sorted[i].text.split(/\s+/).length / WORDS_PER_SECOND);
    }
    sorted[i].timestamp = [round2(start), round2(fixedEnd)];
  }
  return mergeRollingDuplicates(sorted);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
