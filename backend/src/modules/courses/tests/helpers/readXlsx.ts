import {inflateRawSync} from 'zlib';

/** Reads every file out of a zip (central directory; stored or deflated). */
export function unzip(buf: Buffer): Map<string, Buffer> {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('Not a zip file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start =
      local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    files.set(name, method === 8 ? inflateRawSync(data) : data);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const unescape = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');

function colIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Sheet names and each sheet's rows (numbers as numbers, text as text). */
export function readXlsx(buf: Buffer): {
  names: string[];
  sheets: (string | number)[][][];
  files: Map<string, Buffer>;
} {
  const files = unzip(buf);
  const workbook = files.get('xl/workbook.xml')!.toString('utf8');
  const names = [...workbook.matchAll(/<sheet name="([^"]*)"/g)].map(m =>
    unescape(m[1]),
  );
  const sheets = names.map((_, i) => {
    const xml = files.get(`xl/worksheets/sheet${i + 1}.xml`)!.toString('utf8');
    return [...xml.matchAll(/<row [^>]*>(.*?)<\/row>/g)].map(row => {
      const cells: (string | number)[] = [];
      for (const c of row[1].matchAll(
        /<c r="([A-Z]+\d+)"([^>]*)>(.*?)<\/c>/g,
      )) {
        const text =
          /<(?:t|v)(?: [^>]*)?>([^<]*)<\/(?:t|v)>/.exec(c[3])?.[1] ?? '';
        const value = c[2].includes('inlineStr')
          ? unescape(text)
          : Number(text);
        cells[colIndex(c[1])] = value;
      }
      return Array.from(cells, v => (v === undefined ? '' : v));
    });
  });
  return {names, sheets, files};
}
