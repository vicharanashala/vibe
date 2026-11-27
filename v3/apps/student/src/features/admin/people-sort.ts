import type { PeopleSortBy } from './queries';

export type SortOrder = 'asc' | 'desc';
export type PeopleSort = { by: PeopleSortBy; order: SortOrder };

/** What the backend does when asked for nothing: newest enrolment first. */
export const DEFAULT_PEOPLE_SORT: PeopleSort = { by: 'enrollmentDate', order: 'desc' };

/** The direction a column starts in when first picked. */
const FIRST_ORDER: Record<PeopleSortBy, SortOrder> = {
  name: 'asc',
  progress: 'desc',
  enrollmentDate: 'desc',
};

/** Picking the sorted column again flips it; picking another starts that one in its natural direction. */
export function nextSort(current: PeopleSort, by: PeopleSortBy): PeopleSort {
  if (current.by === by) return { by, order: current.order === 'asc' ? 'desc' : 'asc' };
  return { by, order: FIRST_ORDER[by] };
}

export const SORT_OPTIONS: (PeopleSort & { label: string })[] = [
  { by: 'enrollmentDate', order: 'desc', label: 'Newest first' },
  { by: 'enrollmentDate', order: 'asc', label: 'Oldest first' },
  { by: 'name', order: 'asc', label: 'Name, A to Z' },
  { by: 'name', order: 'desc', label: 'Name, Z to A' },
  { by: 'progress', order: 'desc', label: 'Most progress' },
  { by: 'progress', order: 'asc', label: 'Least progress' },
];

export const sortKey = (s: PeopleSort) => `${s.by}:${s.order}`;

/** The sort in the URL (`?sort=progress&order=desc`), or nothing if it isn't one we offer. */
export function parsePeopleSort(sort: unknown, order: unknown): PeopleSort | undefined {
  const found = SORT_OPTIONS.find((o) => o.by === sort && o.order === order);
  return found ? { by: found.by, order: found.order } : undefined;
}

export const isDefaultSort = (s: PeopleSort) => sortKey(s) === sortKey(DEFAULT_PEOPLE_SORT);
