export interface ProgressRule {
  timeframeDays: number;
  targetPercentage: number;
}

export interface Milestone {
  targetPercentage: number;
  date: Date;
  studentFormattedString: string;
}

/**
 * Calculates the next specific milestones based on a policy's progress rules.
 * @param progressRules The policy's rules (e.g. 25% every 7 days)
 * @param startDate The baseline date to calculate from (either enrollment date or today)
 * @param currentProgressPercent The student's current completion percentage (0 for teacher previews)
 */
export const calculateNextMilestones = (
  progressRules: any[],
  startDate: Date | string,
  currentProgressPercent: number | string | undefined | null
): Milestone[] => {
  if (!progressRules || progressRules.length === 0) return [];
  
  // Guarantee a clean number is parsed
  const cleanProgress = Number(currentProgressPercent) || 0;

  const milestones: Milestone[] = [];

  // Normalize startDate to local midnight to avoid timezone shift inconsistencies
  let baseDate = new Date(startDate);
  if (typeof startDate === 'string') {
    // Extract purely the YYYY-MM-DD part from the ISO string to prevent local timezone from pushing it to the next day
    const datePart = startDate.split('T')[0];
    if (datePart && datePart.includes('-')) {
      const [year, month, day] = datePart.split('-');
      if (year && month && day) {
        baseDate = new Date(Number(year), Number(month) - 1, Number(day));
      }
    }
  }
  baseDate.setHours(0, 0, 0, 0);

  for (const rule of progressRules) {
    if (rule.targetPercentage <= 0 || rule.timeframeDays <= 0) continue;

    // Determine which multiplier block the current progress falls into
    let n = Math.floor(cleanProgress / rule.targetPercentage) + 1;
    
    if (currentProgressPercent >= 100) {
      continue; // Student has completed all milestones for this rule
    }

    const targetPercentage = Math.min(n * rule.targetPercentage, 100);
    
    // Add N * timeframeDays to the startDate
    const targetDate = new Date(baseDate);
    targetDate.setDate(targetDate.getDate() + n * rule.timeframeDays);

    const dd = String(targetDate.getDate()).padStart(2, '0');
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const yy = String(targetDate.getFullYear()).slice(-2);
    
    milestones.push({
      targetPercentage,
      date: targetDate,
      studentFormattedString: `Next milestone: ${targetPercentage}% progress by ${dd}/${mm}/${yy}`
    });
  }

  return milestones;
}
