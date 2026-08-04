import {ObjectId} from 'mongodb';
import {describe, it, expect, beforeEach} from 'vitest';
import {ForbiddenError, BadRequestError} from 'routing-controllers';

import {
  CohortScopeService,
  cohortScopeFilter,
  cohortScopeIds,
  filterCohortDetails,
  requireSingleCohort,
} from '#root/shared/functions/cohortScope.js';
import {AuthenticatedUser} from '#root/shared/interfaces/models.js';

const COURSE_ID = new ObjectId().toString();
const VERSION_ID = new ObjectId().toString();
const COHORT_A = new ObjectId().toString();
const COHORT_B = new ObjectId().toString();

function user(
  overrides: Partial<AuthenticatedUser> & {
    enrollments?: AuthenticatedUser['enrollments'];
  } = {},
): AuthenticatedUser {
  return {
    userId: new ObjectId().toString(),
    globalRole: 'user',
    enrollments: [],
    ...overrides,
  };
}

function enrollment(
  role: AuthenticatedUser['enrollments'][number]['role'],
  cohortIds: string[] | null,
) {
  return {courseId: COURSE_ID, versionId: VERSION_ID, role, cohortIds};
}

describe('CohortScopeService.resolve', () => {
  let service: CohortScopeService;

  beforeEach(() => {
    service = new CohortScopeService();
  });

  it('leaves an admin unrestricted', () => {
    const scope = service.resolve(
      user({globalRole: 'admin'}),
      COURSE_ID,
      VERSION_ID,
    );
    expect(cohortScopeIds(scope)).toBeNull();
  });

  it('narrows an admin to a cohort they explicitly ask for', () => {
    const scope = service.resolve(
      user({globalRole: 'admin'}),
      COURSE_ID,
      VERSION_ID,
      COHORT_B,
    );
    expect(cohortScopeIds(scope)?.map(String)).toEqual([COHORT_B]);
  });

  it('confines an instructor to their assigned cohorts', () => {
    const scope = service.resolve(
      user({enrollments: [enrollment('INSTRUCTOR', [COHORT_A])]}),
      COURSE_ID,
      VERSION_ID,
    );
    expect(cohortScopeIds(scope)?.map(String)).toEqual([COHORT_A]);
  });

  it('refuses a cohort the instructor was not assigned', () => {
    expect(() =>
      service.resolve(
        user({enrollments: [enrollment('INSTRUCTOR', [COHORT_A])]}),
        COURSE_ID,
        VERSION_ID,
        COHORT_B,
      ),
    ).toThrow(ForbiddenError);
  });

  it('fails open for an instructor with no assignment', () => {
    const scope = service.resolve(
      user({enrollments: [enrollment('INSTRUCTOR', null)]}),
      COURSE_ID,
      VERSION_ID,
    );
    expect(cohortScopeIds(scope)).toBeNull();
  });

  it('lets an unassigned instructor still request one cohort', () => {
    const scope = service.resolve(
      user({enrollments: [enrollment('INSTRUCTOR', null)]}),
      COURSE_ID,
      VERSION_ID,
      COHORT_B,
    );
    expect(cohortScopeIds(scope)?.map(String)).toEqual([COHORT_B]);
  });

  it('keeps MANAGER and TA cohort-agnostic', () => {
    for (const role of ['MANAGER', 'TA'] as const) {
      const scope = service.resolve(
        user({enrollments: [enrollment(role, null)]}),
        COURSE_ID,
        VERSION_ID,
      );
      expect(cohortScopeIds(scope)).toBeNull();
    }
  });

  it('pins a student to their own cohort and refuses a wider request', () => {
    expect(() =>
      service.resolve(
        user({enrollments: [enrollment('STUDENT', [COHORT_A])]}),
        COURSE_ID,
        VERSION_ID,
        COHORT_B,
      ),
    ).toThrow(ForbiddenError);
  });

  it('unions cohorts when a caller holds several enrollments on the version', () => {
    const scope = service.resolve(
      user({
        enrollments: [
          enrollment('INSTRUCTOR', [COHORT_A]),
          enrollment('STAFF', [COHORT_B]),
        ],
      }),
      COURSE_ID,
      VERSION_ID,
    );
    expect(cohortScopeIds(scope)?.map(String).sort()).toEqual(
      [COHORT_A, COHORT_B].sort(),
    );
  });

  it('ignores an assignment held on a different course version', () => {
    const scope = service.resolve(
      user({
        enrollments: [
          {
            courseId: COURSE_ID,
            versionId: new ObjectId().toString(),
            role: 'INSTRUCTOR' as const,
            cohortIds: [COHORT_B],
          },
        ],
      }),
      COURSE_ID,
      VERSION_ID,
    );
    expect(cohortScopeIds(scope)).toBeNull();
  });
});

describe('scope helpers', () => {
  it('contributes no filter when unrestricted', () => {
    expect(cohortScopeFilter({cohortIds: null})).toEqual({});
  });

  it('always filters with $in, even for a single cohort', () => {
    const id = new ObjectId();
    expect(cohortScopeFilter({cohortIds: [id]})).toEqual({
      cohortId: {$in: [id]},
    });
  });

  it('drops cohorts outside the scope from the dropdown payload', () => {
    const details = [{id: COHORT_A}, {id: COHORT_B}];
    expect(
      filterCohortDetails(details, {cohortIds: [new ObjectId(COHORT_A)]}),
    ).toEqual([{id: COHORT_A}]);
  });

  it('leaves the dropdown payload untouched when unrestricted', () => {
    const details = [{id: COHORT_A}, {id: COHORT_B}];
    expect(filterCohortDetails(details, {cohortIds: null})).toEqual(details);
  });

  it('collapses a single-cohort scope without asking', () => {
    expect(
      requireSingleCohort({cohortIds: [new ObjectId(COHORT_A)]}),
    ).toEqual(COHORT_A);
  });

  it('asks a multi-cohort caller to choose', () => {
    expect(() =>
      requireSingleCohort({
        cohortIds: [new ObjectId(COHORT_A), new ObjectId(COHORT_B)],
      }),
    ).toThrow(BadRequestError);
  });
});
