/**
 * Motivation module — request validator classes.
 *
 * Mirrors the spaced-repetition pattern: every request body and
 * path param has a class-validator decorated class. The routing-
 * controllers `validation: true` setting wires these up automatically.
 */

import { IsNotEmpty, IsOptional, IsString, IsBoolean, Min } from 'class-validator';

/** Path params for `/:studentId/...` endpoints. */
export class StudentIdParam {
  @IsString()
  @IsNotEmpty()
  studentId!: string;
}

/** Path params for `/courses/:courseId/...` endpoints. */
export class CourseIdParam {
  @IsString()
  @IsNotEmpty()
  courseId!: string;
}

/** Optional query for the leaderboard endpoint. v1 ignores limit. */
export class LeaderboardQuery {
  @IsOptional()
  @Min(1)
  limit?: number;
}

/** Query for the mentor-view endpoint. courseId is required. */
export class MentorViewQuery {
  @IsString()
  @IsNotEmpty()
  courseId!: string;
}

/**
 * Path params for `/:studentId/courses/:courseId/...` endpoints.
 * Used by the Pillar 3 opt-out endpoint.
 */
export class StudentCoursePathParam {
  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsString()
  @IsNotEmpty()
  courseId!: string;
}

/**
 * Body for `PATCH /:studentId/courses/:courseId/opt-out`.
 *
 * `optedOut` is the desired new state — true to opt out, false to come
 * back. The endpoint is idempotent: flipping to the current state is a
 * no-op (the repo returns `false` for "state changed", which we surface
 * in the response as `changed: false`).
 *
 * Added 2026-07-25 for Pillar 3.
 */
export class OptOutBody {
  @IsBoolean()
  optedOut!: boolean;
}
