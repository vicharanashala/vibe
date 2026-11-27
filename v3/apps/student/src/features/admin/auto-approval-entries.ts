/**
 * Helpers for the auto-approval list: what counts as an entry, and turning a
 * CSV file into email addresses. No UI, so the rules can be tested directly.
 */

const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const LOCAL_PART = /^[^\s@]+$/;

export type ParsedEntry = { kind: 'address' | 'domain'; value: string };

/**
 * Same rules as the backend's parseEntry (courseRegistration/utils/autoApproval.ts):
 * text before the `@` makes a full address; a leading `@`, or no `@`, a domain.
 */
export function parseEntry(entry: string): ParsedEntry | null {
  const value = entry.trim().toLowerCase();
  const at = value.lastIndexOf('@');
  const domain = value.slice(at + 1);
  if (!DOMAIN.test(domain)) return null;
  if (at <= 0) return { kind: 'domain', value: domain };
  return LOCAL_PART.test(value.slice(0, at))
    ? { kind: 'address', value }
    : null;
}

/** Splits pasted text into entries. Handles lines, commas, semicolons and spaces. */
export function splitEntries(text: string): string[] {
  return text.split(/[\s,;]+/).filter(Boolean);
}

/**
 * Adds valid `incoming` entries to `current`, lower-cased, skipping any already
 * there. `x.com` and `@x.com` count as the same entry, as they do on the backend.
 */
export function mergeEntries(current: string[], incoming: string[]): string[] {
  const seen = new Set(current.map((e) => parseEntry(e)?.value ?? e));
  const merged = [...current];
  for (const raw of incoming) {
    const parsed = parseEntry(raw);
    if (!parsed || seen.has(parsed.value)) continue;
    seen.add(parsed.value);
    merged.push(raw.trim().toLowerCase());
  }
  return merged;
}

/**
 * The backend reads this request with the default body limit of 100 KB, and
 * answers anything larger with a 500. That is about 3,500 typical addresses.
 */
const MAX_SAVE_BYTES = 100 * 1024;

export function listFitsInOneSave(emails: string[]): boolean {
  const body = JSON.stringify({
    registrationsAutoApproved: true,
    autoApprovalMode: 'LIST',
    autoapproval_emails: emails,
  });
  return new TextEncoder().encode(body).length <= MAX_SAVE_BYTES;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Picks the separator used most in the first line, so `;` and tab files work too. */
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r\n|\n|\r/, 1)[0] ?? '';
  let best = ',';
  let bestCount = 0;
  for (const delimiter of [',', ';', '\t']) {
    const count = firstLine.split(delimiter).length - 1;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

/** Parses CSV text into rows, handling quoted cells, `""` and line breaks in quotes. */
export function parseCsv(input: string): string[][] {
  const text = input.startsWith('\uFEFF') ? input.slice(1) : input;
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  const endRow = () => {
    row.push(cell);
    cell = '';
    if (row.some((c) => c.trim())) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
    } else if (c === '"' && !cell) quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = '';
    } else if (c === '\n') endRow();
    else if (c === '\r') {
      if (text[i + 1] === '\n') i++;
      endRow();
    } else cell += c;
  }
  endRow();
  return rows;
}

export interface CsvTable {
  columns: string[];
  rows: string[][];
}

const isAddress = (value: string) => parseEntry(value)?.kind === 'address';

/** The first row names the columns, unless it already holds an email address. */
export function toCsvTable(cells: string[][]): CsvTable {
  const first = cells[0] ?? [];
  const hasHeader = !first.some(isAddress);
  const rows = hasHeader ? cells.slice(1) : cells;
  const width = Math.max(0, ...cells.map((r) => r.length));
  const columns = Array.from({ length: width }, (_, i) => {
    const name = hasHeader ? first[i]?.trim() : '';
    return name || `Column ${i + 1}`;
  });
  return { columns, rows };
}

/** The column holding the most email addresses, so the usual choice is already made. */
export function likelyEmailColumn(table: CsvTable): number {
  let best = 0;
  let bestCount = 0;
  table.columns.forEach((_, index) => {
    const count = table.rows.filter((r) => isAddress(r[index] ?? '')).length;
    if (count > bestCount) {
      best = index;
      bestCount = count;
    }
  });
  return best;
}

export interface ColumnSummary {
  /** New addresses, lower-cased and without repeats. */
  toAdd: string[];
  alreadyListed: number;
  repeated: number;
  /** Values that aren't full email addresses, without repeats. */
  skipped: string[];
}

/**
 * Only full addresses are taken from a file. A cell like `gmail.com` is a valid
 * domain entry, and approving a whole domain should never come from picking the
 * wrong column. So should `1.5`, which also has the shape of a domain.
 */
export function summarizeColumn(
  table: CsvTable,
  column: number,
  existing: string[],
): ColumnSummary {
  const listed = new Set(existing.map((e) => parseEntry(e)?.value ?? e));
  const added = new Set<string>();
  const skipped = new Set<string>();
  let alreadyListed = 0;
  let repeated = 0;
  for (const row of table.rows) {
    const value = (row[column] ?? '').trim();
    if (!value) continue;
    const parsed = parseEntry(value);
    if (parsed?.kind !== 'address') skipped.add(value);
    else if (listed.has(parsed.value)) alreadyListed++;
    else if (added.has(parsed.value)) repeated++;
    else added.add(parsed.value);
  }
  return {
    toAdd: [...added],
    alreadyListed,
    repeated,
    skipped: [...skipped],
  };
}
