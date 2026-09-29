// Read a transcript file of whatever kind an instructor has and return its text.
// The backend finds the timestamps; this only gets the words out of the file:
// Word (.docx) and spreadsheets (.xlsx/.xls/.ods) are unpacked here, everything
// else (.srt, .vtt, .sbv, .txt, .csv, .json, …) is read as plain text.

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function readTranscriptFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("This file is larger than 15 MB. Please upload only the transcript.");
  }
  const name = file.name.toLowerCase();

  if (name.endsWith(".docx")) return extractDocxText(await file.arrayBuffer());
  if (/\.(xlsx|xls|ods)$/.test(name)) return spreadsheetToText(await file.arrayBuffer());
  if (name.endsWith(".doc")) {
    throw new Error("Old Word (.doc) files cannot be read. Please save it as .docx, or copy the text into the paste box.");
  }
  if (name.endsWith(".pdf")) {
    throw new Error("PDF files cannot be read. Please copy the transcript text into the paste box instead.");
  }
  return file.text();
}

/** Every sheet as CSV, one after another. */
async function spreadsheetToText(buffer: ArrayBuffer): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  return workbook.SheetNames.map((sheet) => XLSX.utils.sheet_to_csv(workbook.Sheets[sheet])).join("\n");
}

/**
 * A .docx file is a zip archive; the text lives in word/document.xml. Read the
 * zip's central directory, inflate that one entry with the browser's built-in
 * DecompressionStream, and turn paragraphs into lines.
 */
async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const invalid = () => new Error("This does not look like a valid Word (.docx) file.");

  // End-of-central-directory record: in the last 22 bytes plus up to 64 KB of comment.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw invalid();

  const entries = view.getUint16(eocd + 10, true);
  let pointer = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();

  for (let n = 0; n < entries; n++) {
    if (view.getUint32(pointer, true) !== 0x02014b50) throw invalid();
    const method = view.getUint16(pointer + 10, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const localHeader = view.getUint32(pointer + 42, true);
    const entryName = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength));

    if (entryName === "word/document.xml") {
      const dataStart = localHeader + 30 + view.getUint16(localHeader + 26, true) + view.getUint16(localHeader + 28, true);
      const data = bytes.slice(dataStart, dataStart + compressedSize);
      const xml = method === 0 ? decoder.decode(data) : await inflateRaw(data.buffer);
      return documentXmlToText(xml);
    }
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error("No text was found in this Word file.");
}

async function inflateRaw(data: ArrayBuffer): Promise<string> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw" as CompressionFormat));
  return new Response(stream).text();
}

/**
 * Walk the document XML tag by tag: paragraph ends and line breaks become new
 * lines, tabs become tabs, every other tag is dropped. A single pass with
 * indexOf, so large documents stay fast.
 */
function documentXmlToText(xml: string): string {
  let out = "";
  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf("<", i);
    if (lt === -1) {
      out += xml.slice(i);
      break;
    }
    out += xml.slice(i, lt);
    const gt = xml.indexOf(">", lt);
    if (gt === -1) break;
    const tag = xml.slice(lt + 1, gt);
    const name = tag.split(/[\s/]/)[0];
    if (tag === "/w:p") out += "\n";
    else if (name === "w:tab" && tag.endsWith("/")) out += "\t";
    else if ((name === "w:br" || name === "w:cr") && tag.endsWith("/")) out += "\n";
    i = gt + 1;
  }
  return out
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
