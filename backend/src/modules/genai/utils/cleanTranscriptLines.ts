// Helper function to clean transcript lines by removing timestamps and merging into one string
function cleanTranscriptLines(transcriptLines: string[]): string {
  return transcriptLines
    .map(line => {
      // Remove timestamp pattern [00:00.000 --> 00:00.000] from the beginning of each line (with brackets)
      let cleaned = line
        .replace(/^\[[\d:.-]+\s*-->\s*[\d:.-]+\]\s*/, '')
        .trim();

      // Also remove timestamp pattern 00:00.000 --> 00:00.000 from the beginning of each line (without brackets)
      cleaned = cleaned.replace(/^[\d:.-]+\s*-->\s*[\d:.-]+\s+/, '').trim();

      return cleaned;
    })
    .filter(line => line.length > 0) // Remove empty lines
    .join(' '); // Join all lines into a single string with spaces
}
export {cleanTranscriptLines};
