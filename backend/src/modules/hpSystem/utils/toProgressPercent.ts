/**
 * A student's completion percentage as a usable number.
 *
 * `value ?? 0` on its own is not enough for the milestone reward check: it
 * lets NaN through, and `NaN < required` is false, so a student with an
 * invalid progress value would be treated as having reached the milestone.
 * Anything that is not a finite number therefore counts as no progress.
 */
export const toProgressPercent = (value: unknown): number => {
    const percent = Number(value ?? 0);
    return Number.isFinite(percent) ? percent : 0;
};
