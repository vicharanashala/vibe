/**
 * Must match `backend/src/modules/caseStudies/constants.ts`'s `countWords`
 * exactly, so the displayed count never disagrees with what the server will
 * accept. Case-study text mixes Hindi and English freely, so this counts
 * runs of letters/combining-marks/digits rather than splitting on spaces.
 */
export function countWords(text: string): number {
  const matches = text.trim().match(/[\p{L}\p{M}\p{N}]+/gu);
  return matches ? matches.length : 0;
}
