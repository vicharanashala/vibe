import {ObjectId} from 'mongodb';
import {BadRequestError, ForbiddenError} from 'routing-controllers';
import {injectable} from 'inversify';
import {AuthenticatedUser} from '#root/shared/interfaces/models.js';

/**
 * Roles whose reach is confined to explicitly assigned cohorts. MANAGER and TA
 * are deliberately excluded — they retain course/version-wide reach.
 */
export const COHORT_SCOPED_ROLES: ReadonlySet<string> = new Set([
  'INSTRUCTOR',
  'STAFF',
]);

/**
 * The set of cohorts a caller may read or act on for one course version.
 *
 * `cohortIds: null` means **unrestricted** — admins, cohort-agnostic roles
 * (MANAGER/TA) and versions that have no cohorts at all. Read it through
 * `cohortScopeFilter`/`cohortScopeIds` rather than testing the field, so the
 * null convention stays in one place.
 *
 * (Modelled as one shape rather than a discriminated union because this
 * project compiles with `strict: false`, where boolean-literal discriminants
 * do not narrow.)
 */
export interface CohortScope {
  cohortIds: ObjectId[] | null;
}

/**
 * Translate a scope into a Mongo filter fragment. An unrestricted scope
 * contributes nothing; a restricted one always contributes an `$in`, even for
 * a single cohort, so callers cannot accidentally widen it later.
 */
export function cohortScopeFilter(
  scope: CohortScope,
  field = 'cohortId',
): Record<string, unknown> {
  if (!scope || scope.cohortIds === null) return {};
  return {[field]: {$in: scope.cohortIds}};
}

/** The cohort ids in a scope, or `null` when it is unrestricted. */
export function cohortScopeIds(scope: CohortScope): ObjectId[] | null {
  return scope?.cohortIds ?? null;
}

/**
 * Collapse a scope to a single cohort id, for the few reads that can only
 * express one. An unrestricted caller keeps the "all cohorts" behaviour; a
 * scoped one holding several must say which, rather than silently getting one.
 */
export function requireSingleCohort(
  scope: CohortScope,
  requestedCohortId?: string,
): string | undefined {
  if (requestedCohortId) return requestedCohortId;
  const ids = cohortScopeIds(scope);
  if (ids === null) return undefined;
  if (ids.length === 1) return ids[0].toString();
  throw new BadRequestError(
    'You have access to more than one cohort — select which cohort to use',
  );
}

/**
 * Narrow a hydrated `cohortDetails` list to the caller's scope. Every cohort
 * picker in the UI — including the invite dialog's — is populated from this
 * list, so filtering it here is what keeps other cohorts out of the dropdowns.
 */
export function filterCohortDetails<T extends {id: string}>(
  details: T[] | undefined,
  scope: CohortScope,
): T[] | undefined {
  const ids = cohortScopeIds(scope);
  if (!details || ids === null) return details;
  const allowed = new Set(ids.map(id => id.toString()));
  return details.filter(cohort => allowed.has(cohort.id));
}

const UNRESTRICTED: CohortScope = {cohortIds: null};

/**
 * Resolves which cohorts a caller may touch on a given course version.
 *
 * This is the single place that decides cohort visibility. Call sites must
 * pass the resolved scope into their queries instead of the request's
 * `cohortId` — a client-supplied cohort is a *request*, never a grant.
 */
@injectable()
export class CohortScopeService {
  resolve(
    user: AuthenticatedUser,
    courseId: string,
    versionId: string,
    requestedCohortId?: string,
  ): CohortScope {
    const allowed = this.allowedCohortIds(user, courseId, versionId);

    if (allowed !== null && requestedCohortId) {
      if (!allowed.includes(requestedCohortId)) {
        throw new ForbiddenError(
          'You do not have access to the requested cohort',
        );
      }
    }

    if (requestedCohortId) {
      return {cohortIds: [toObjectId(requestedCohortId)]};
    }

    return allowed === null ? UNRESTRICTED : {cohortIds: allowed.map(toObjectId)};
  }

  /**
   * Cohorts allowed across every enrollment the caller holds on this version,
   * or `null` when the caller is not confined at all.
   *
   * Unconfined covers admins, cohort-agnostic roles, staff with no assignment,
   * and callers holding no enrollment here — for the last of those, CASL is
   * already the gate, so widening is not this function's job.
   */
  allowedCohortIds(
    user: AuthenticatedUser,
    courseId: string,
    versionId: string,
  ): string[] | null {
    if (user.globalRole === 'admin') return null;

    const matching = user.enrollments.filter(
      e => e.courseId === courseId && e.versionId === versionId,
    );
    if (matching.length === 0) return null;
    if (matching.some(e => e.cohortIds === null)) return null;

    const union = [...new Set(matching.flatMap(e => e.cohortIds ?? []))];
    return union.length > 0 ? union : null;
  }
}

function toObjectId(id: string): ObjectId {
  if (!ObjectId.isValid(id)) {
    throw new ForbiddenError('Invalid cohort identifier');
  }
  return new ObjectId(id);
}
