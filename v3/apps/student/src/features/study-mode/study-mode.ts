import { ApiError } from '@vibe/api';

/** Which level of the course an effective study-mode value came from (backend `resolveStudyMode`). */
export type StudyModeSource = 'item' | 'section' | 'module' | 'default';

export interface ResolvedStudyMode {
  allowed: boolean;
  source: StudyModeSource;
}

/** A module, section or item ref as the API returns it; `null`/absent means "inherit". */
export interface StudyModeNode {
  studyModeEnabled?: boolean | null;
}

/**
 * Mirrors the backend's resolveStudyMode: item, then section, then module;
 * allowed when nothing is set. Used where the app only has the course outline
 * (the lesson response already carries the resolved value).
 */
export function resolveStudyMode(
  item: StudyModeNode | undefined,
  section: StudyModeNode | undefined,
  module: StudyModeNode | undefined,
): ResolvedStudyMode {
  if (item?.studyModeEnabled != null) return { allowed: item.studyModeEnabled, source: 'item' };
  if (section?.studyModeEnabled != null) return { allowed: section.studyModeEnabled, source: 'section' };
  if (module?.studyModeEnabled != null) return { allowed: module.studyModeEnabled, source: 'module' };
  return { allowed: true, source: 'default' };
}

export type StudyModeRefusal =
  | { kind: 'disabled'; source: Exclude<StudyModeSource, 'default'> }
  | { kind: 'quiz' };

/**
 * The backend refuses a study-mode read with a 403 whose body `name` says why
 * (STUDY_MODE_DISABLED with `details.source`, or STUDY_MODE_QUIZ). Anything
 * else — including a linear-progression 403 — is not a study-mode refusal.
 */
export function studyModeRefusal(error: unknown): StudyModeRefusal | undefined {
  if (!(error instanceof ApiError) || error.status !== 403) return undefined;
  const body = error.body as { name?: string; details?: { source?: string } } | null;
  if (body?.name === 'STUDY_MODE_QUIZ') return { kind: 'quiz' };
  if (body?.name === 'STUDY_MODE_DISABLED') {
    const source = body.details?.source;
    return {
      kind: 'disabled',
      source: source === 'item' || source === 'section' || source === 'module' ? source : 'item',
    };
  }
  return undefined;
}

/** "this module" / "this section" / "this lesson" — the level named in instructor-disabled notices. */
export function studyModeLevel(source: StudyModeSource): string {
  if (source === 'module') return 'this module';
  if (source === 'section') return 'this section';
  return 'this lesson';
}
