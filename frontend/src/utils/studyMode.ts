/**
 * Study mode, as the backend resolves it: a module, section or item can allow
 * it (true), disallow it (false) or inherit (null/absent). An item looks at
 * itself, then its section, then its module; with nothing set study mode is
 * allowed. Kept pure so the rules are unit tested without mounting the pages.
 */
export type StudyModeSource = 'item' | 'section' | 'module' | 'default';

export interface ResolvedStudyMode {
  allowed: boolean;
  source: StudyModeSource;
}

export interface StudyModeNode {
  studyModeEnabled?: boolean | null;
}

export function resolveStudyMode(
  item: StudyModeNode | undefined,
  section: StudyModeNode | undefined,
  module: StudyModeNode | undefined,
): ResolvedStudyMode {
  if (item?.studyModeEnabled != null) return {allowed: item.studyModeEnabled, source: 'item'};
  if (section?.studyModeEnabled != null) return {allowed: section.studyModeEnabled, source: 'section'};
  if (module?.studyModeEnabled != null) return {allowed: module.studyModeEnabled, source: 'module'};
  return {allowed: true, source: 'default'};
}

/** The editor's view of one node: its own setting, what it would inherit, and the result. */
export interface StudyModeState {
  own: boolean | null;
  inherited: boolean;
  effective: boolean;
  isInherited: boolean;
}

/**
 * `parents` are the levels above the node, nearest first: [section, module]
 * for an item, [module] for a section, [] for a module.
 */
export function studyModeState(node: StudyModeNode | undefined, parents: (StudyModeNode | undefined)[]): StudyModeState {
  const own = node?.studyModeEnabled ?? null;
  const [nearest, outer] = parents;
  const inherited =
    parents.length >= 2
      ? resolveStudyMode(undefined, nearest, outer).allowed
      : parents.length === 1
        ? resolveStudyMode(undefined, undefined, nearest).allowed
        : true;
  return {own, inherited, effective: own ?? inherited, isInherited: own === null};
}

/** "this module" / "this section" / "this lesson" for instructor-disabled notices. */
export function studyModeLevel(source: StudyModeSource | undefined): string {
  if (source === 'module') return 'this module';
  if (source === 'section') return 'this section';
  return 'this lesson';
}

export type PhoneLessonMode = 'normal' | 'study' | 'fallback';

/**
 * What the student page does with a lesson on a given device:
 * - a computer, or a phone opening an item whose proctoring is all off,
 *   keeps today's behaviour ('normal');
 * - a phone opening a video where study mode is allowed watches it in study
 *   mode: no proctoring, no progress ('study');
 * - anything else on a phone gets the "use a computer" screen ('fallback').
 */
export function phoneLessonMode(
  item: {type?: string; studyMode?: ResolvedStudyMode} | undefined,
  isMobile: boolean,
  allProctorsDisabled: boolean,
): PhoneLessonMode {
  if (!isMobile || allProctorsDisabled) return 'normal';
  const type = item?.type?.toUpperCase();
  if (type === 'VIDEO' && item?.studyMode?.allowed === true) return 'study';
  return 'fallback';
}

export type StudyModeRefusal = {kind: 'disabled'; source: StudyModeSource} | {kind: 'quiz'};

/**
 * The backend refuses a study-mode read with a 403 whose body `name` says why:
 * STUDY_MODE_DISABLED (with `details.source`) or STUDY_MODE_QUIZ. Anything else
 * is not a study-mode refusal.
 */
export function studyModeRefusal(body: unknown): StudyModeRefusal | undefined {
  const b = body as {name?: string; details?: {source?: string}} | null | undefined;
  if (b?.name === 'STUDY_MODE_QUIZ') return {kind: 'quiz'};
  if (b?.name === 'STUDY_MODE_DISABLED') {
    const s = b.details?.source;
    return {kind: 'disabled', source: s === 'module' || s === 'section' || s === 'item' ? s : 'item'};
  }
  return undefined;
}
