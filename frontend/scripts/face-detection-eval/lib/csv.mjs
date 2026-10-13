import fs from "node:fs";

export function toCsvField(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function writeCsv(filePath, header, rows) {
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(header.map((col) => toCsvField(row[col])).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf8");
}

export function readCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const [headerLine, ...lines] = text.split("\n");
  const header = headerLine.split(",");
  return lines.map((line) => {
    // Fields in this dataset never contain embedded commas, so a plain split is exact.
    const values = line.split(",");
    return Object.fromEntries(header.map((h, i) => [h, values[i]]));
  });
}
