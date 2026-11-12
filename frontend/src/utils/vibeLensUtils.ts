/**
 * Utility functions for ViBe Lens AI Solver
 */

/**
 * Format seconds to MM:SS string display.
 */
export function formatLensTime(seconds: number): string {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    return '00:00';
  }
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Checks whether ViBe Lens AI Solver should be active given both
 * course-level and item-level permissions.
 * Defaults to true if permissions are not explicitly disabled.
 */
export function isLensFeatureActive(courseLensEnabled?: boolean, itemLensEnabled?: boolean): boolean {
  return courseLensEnabled !== false && itemLensEnabled !== false;
}

/**
 * Parsed element types from AI solver response
 */
export interface ParsedSolverBlock {
  type: 'code' | 'heading' | 'bullet' | 'paragraph';
  content: string;
  language?: string;
}

/**
 * Parses raw markdown explanation text into structured blocks
 * suitable for the student-friendly explanation UI.
 */
export function parseSolverResponse(text: string): ParsedSolverBlock[] {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split('\n');
  const blocks: ParsedSolverBlock[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = '';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Code fence handling
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({
          type: 'code',
          content: codeLines.join('\n'),
          language: codeLang || 'text',
        });
        codeLines = [];
        inCodeBlock = false;
        codeLang = '';
      } else {
        inCodeBlock = true;
        codeLang = trimmed.replace(/^```/, '').trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (!trimmed) {
      continue;
    }

    // Headings
    if (trimmed.startsWith('#')) {
      blocks.push({
        type: 'heading',
        content: trimmed.replace(/^#+\s*/, ''),
      });
      continue;
    }

    // Bullet points
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push({
        type: 'bullet',
        content: trimmed.substring(2).trim(),
      });
      continue;
    }

    // Default paragraph
    blocks.push({
      type: 'paragraph',
      content: trimmed,
    });
  }

  // Handle unclosed code block if stream cut off
  if (inCodeBlock && codeLines.length > 0) {
    blocks.push({
      type: 'code',
      content: codeLines.join('\n'),
      language: codeLang || 'text',
    });
  }

  return blocks;
}
