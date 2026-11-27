/**
 * Content locks, as the backend resolves them: a module, section or item can
 * be locked (true), kept open (false) or inherit (null/absent). An item looks
 * at itself, then its section, then its module; with nothing set it's open.
 * Only drives labels and icons here: the backend decides access. Kept pure so
 * the rules are unit tested without mounting the pages.
 */
export type ContentLockSource = 'item' | 'section' | 'module' | 'default';

export interface ResolvedContentLock {
  locked: boolean;
  source: ContentLockSource;
}

export interface ContentLockNode {
  isLocked?: boolean | null;
}

export function resolveContentLock(
  item: ContentLockNode | undefined,
  section: ContentLockNode | undefined,
  module: ContentLockNode | undefined,
): ResolvedContentLock {
  if (item?.isLocked != null) return {locked: item.isLocked, source: 'item'};
  if (section?.isLocked != null) return {locked: section.isLocked, source: 'section'};
  if (module?.isLocked != null) return {locked: module.isLocked, source: 'module'};
  return {locked: false, source: 'default'};
}

/** The editor's view of one node: its own setting, what it would inherit, and the result. */
export interface ContentLockState {
  own: boolean | null;
  inherited: boolean;
  effective: boolean;
  isInherited: boolean;
}

/**
 * `parents` are the levels above the node, nearest first: [section, module]
 * for an item, [module] for a section, [] for a module.
 */
export function contentLockState(
  node: ContentLockNode | undefined,
  parents: (ContentLockNode | undefined)[],
): ContentLockState {
  const own = node?.isLocked ?? null;
  const [nearest, outer] = parents;
  const inherited =
    parents.length >= 2
      ? resolveContentLock(undefined, nearest, outer).locked
      : parents.length === 1
        ? resolveContentLock(undefined, undefined, nearest).locked
        : false;
  return {own, inherited, effective: own ?? inherited, isInherited: own === null};
}

export type LockedLevel = Exclude<ContentLockSource, 'default'>;

/**
 * The backend refuses a locked lesson with a 403 whose body `name` is
 * CONTENT_LOCKED, with `details.source`. Anything else isn't a lock.
 */
export function contentLockRefusal(body: unknown): {source: LockedLevel} | undefined {
  const b = body as {name?: string; details?: {source?: string}} | null | undefined;
  if (b?.name !== 'CONTENT_LOCKED') return undefined;
  const s = b.details?.source;
  return {source: s === 'module' || s === 'section' ? s : 'item'};
}

/** The message students see for a lock at this level. */
export function lockedMessage(source: LockedLevel): string {
  const level = source === 'module' ? 'module' : source === 'section' ? 'section' : 'lesson';
  return `Your instructor has locked this ${level}. You can open it again once they unlock it. Your progress isn’t affected.`;
}
