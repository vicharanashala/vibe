import { ApiError } from '@vibe/api';

/** Which level of the course an effective lock came from (backend `resolveContentLock`). */
export type ContentLockSource = 'item' | 'section' | 'module' | 'default';

export interface ResolvedContentLock {
  locked: boolean;
  source: ContentLockSource;
}

/** A module, section or item ref as the API returns it; `null`/absent means "inherit". */
export interface ContentLockNode {
  isLocked?: boolean | null;
}

/**
 * Mirrors the backend's resolveContentLock: item, then section, then module;
 * open when nothing is set. Only drives icons and labels here: the backend
 * decides access.
 */
export function resolveContentLock(
  item: ContentLockNode | undefined,
  section: ContentLockNode | undefined,
  module: ContentLockNode | undefined,
): ResolvedContentLock {
  if (item?.isLocked != null) return { locked: item.isLocked, source: 'item' };
  if (section?.isLocked != null) return { locked: section.isLocked, source: 'section' };
  if (module?.isLocked != null) return { locked: module.isLocked, source: 'module' };
  return { locked: false, source: 'default' };
}

export type LockedLevel = Exclude<ContentLockSource, 'default'>;

/**
 * The backend refuses a locked lesson with a 403 whose body `name` is
 * CONTENT_LOCKED, with `details.source`. Anything else, including a
 * linear-progression 403, isn't a lock.
 */
export function contentLockRefusal(error: unknown): { source: LockedLevel } | undefined {
  if (!(error instanceof ApiError) || error.status !== 403) return undefined;
  const body = error.body as { name?: string; details?: { source?: string } } | null;
  if (body?.name !== 'CONTENT_LOCKED') return undefined;
  const source = body.details?.source;
  return { source: source === 'section' || source === 'module' ? source : 'item' };
}

/** "this module" / "this section" / "this lesson". */
export function lockedLevelName(source: LockedLevel): string {
  if (source === 'module') return 'this module';
  if (source === 'section') return 'this section';
  return 'this lesson';
}
