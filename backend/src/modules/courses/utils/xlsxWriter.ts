import archiver from 'archiver';
import {PassThrough} from 'stream';

/**
 * A minimal .xlsx (SpreadsheetML) writer: one header row per sheet (bold,
 * frozen, with an auto-filter), text as inline strings, numbers as numbers,
 * and column widths fitted to the content. Built on `archiver`, which the
 * backend already depends on, so exports need no extra library.
 */

export type Cell = string | number | null | undefined;

export interface SheetSpec {
  name: string;
  header: string[];
  rows: Cell[][];
}

// Characters XML 1.0 can't carry at all.
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

function xml(text: string): string {
  return text
    .replace(INVALID_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Excel column letters: 0 -> A, 25 -> Z, 26 -> AA. */
export function columnName(index: number): string {
  let n = index + 1;
  let name = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    name = String.fromCharCode(65 + r) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/**
 * Sheet names Excel accepts: no []:*?/\, not blank, at most 31 characters,
 * unique (case-insensitively) within the workbook.
 */
export function safeSheetNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map(raw => {
    const base =
      raw
        .replace(/[[\]:*?/\\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^'+|'+$/g, '') || 'Sheet';
    let name = base.slice(0, 31);
    for (let i = 2; used.has(name.toLowerCase()); i++) {
      const suffix = ` (${i})`;
      name = base.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(name.toLowerCase());
    return name;
  });
}

function cellXml(ref: string, value: Cell, style?: number): string {
  const s = style ? ` s="${style}"` : '';
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"${s}><v>${value}</v></c>`;
  }
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xml(String(value))}</t></is></c>`;
}

function sheetXml(sheet: SheetSpec): string {
  const width = Math.max(sheet.header.length, 1);
  const widths = Array.from({length: width}, (_, c) => {
    let longest = String(sheet.header[c] ?? '').length;
    for (const row of sheet.rows.slice(0, 500)) {
      const v = row[c];
      if (v !== null && v !== undefined)
        longest = Math.max(longest, String(v).length);
    }
    return Math.min(60, Math.max(8, longest + 2));
  });
  const cols = widths
    .map(
      (w, c) =>
        `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`,
    )
    .join('');
  const rows = [sheet.header, ...sheet.rows]
    .map((row, r) => {
      const cells = row
        .map((v, c) =>
          cellXml(`${columnName(c)}${r + 1}`, v, r === 0 ? 1 : undefined),
        )
        .join('');
      return `<row r="${r + 1}">${cells}</row>`;
    })
    .join('');
  const lastRef = `${columnName(width - 1)}${sheet.rows.length + 1}`;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetViews><sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '</sheetView></sheetViews>' +
    `<cols>${cols}</cols>` +
    `<sheetData>${rows}</sheetData>` +
    `<autoFilter ref="A1:${lastRef}"/>` +
    '</worksheet>'
  );
}

const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

/** Builds the workbook in memory and returns its bytes. */
export async function writeXlsx(sheets: SheetSpec[]): Promise<Buffer> {
  const list = sheets.length ? sheets : [{name: 'Sheet', header: [], rows: []}];
  const names = safeSheetNames(list.map(s => s.name));
  const archive = archiver('zip', {zlib: {level: 6}});
  const out = new PassThrough();
  const chunks: Buffer[] = [];
  out.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<void>((resolve, reject) => {
    out.on('end', resolve);
    archive.on('error', reject);
  });
  archive.pipe(out);

  const sheetEntries = list.map((_, i) => i + 1);
  archive.append(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheetEntries
        .map(
          n =>
            `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join('') +
      '</Types>',
    {name: '[Content_Types].xml'},
  );
  archive.append(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>',
    {name: '_rels/.rels'},
  );
  archive.append(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      names
        .map(
          (n, i) =>
            `<sheet name="${xml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
        )
        .join('') +
      '</sheets>' +
      '<definedNames>' +
      list
        .map(
          (s, i) =>
            `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xml(names[i]).replace(/'/g, "''")}'!$A$1:$${columnName(Math.max(s.header.length, 1) - 1)}$${s.rows.length + 1}</definedName>`,
        )
        .join('') +
      '</definedNames></workbook>',
    {name: 'xl/workbook.xml'},
  );
  archive.append(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheetEntries
        .map(
          n =>
            `<Relationship Id="rId${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/>`,
        )
        .join('') +
      `<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      '</Relationships>',
    {name: 'xl/_rels/workbook.xml.rels'},
  );
  archive.append(STYLES, {name: 'xl/styles.xml'});
  list.forEach((sheet, i) =>
    archive.append(sheetXml(sheet), {name: `xl/worksheets/sheet${i + 1}.xml`}),
  );
  await archive.finalize();
  await done;
  return Buffer.concat(chunks);
}
