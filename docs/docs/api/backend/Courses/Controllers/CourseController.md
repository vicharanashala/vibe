Defined in: [controllers/CourseController.ts:40](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/CourseController.ts#L40)

Controller for managing courses.
Handles API endpoints related to course creation, reading, and updating.
Uses dependency injection to work with CourseRepository and exposes
endpoints under the `/courses` route.

## Constructors

### Constructor

> **new CourseController**(`courseRepo`): `CourseController`

Defined in: [controllers/CourseController.ts:41](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/CourseController.ts#L41)

#### Parameters

##### courseRepo

`CourseRepository`

#### Returns

`CourseController`

## Methods

### create()

> **create**(`body`): `Promise`\<`Record`\<`string`, `any`\>\>

Defined in: [controllers/CourseController.ts:54](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/CourseController.ts#L54)

Create a new course.

#### Parameters

##### body

[`CreateCourseBody`](../Validators/CourseValidators/CreateCourseBody.md)

Validated payload for course creation.

#### Returns

`Promise`\<`Record`\<`string`, `any`\>\>

The created course object.

#### Throws

HttpError - If the course creation fails.

***

### read()

> **read**(`params`): `Promise`\<`Record`\<`string`, `any`\>\>

Defined in: [controllers/CourseController.ts:73](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/CourseController.ts#L73)

Retrieve a course by its ID.

#### Parameters

##### params

[`ReadCourseParams`](../Validators/CourseValidators/ReadCourseParams.md)

Contains the course Mongo ID.

#### Returns

`Promise`\<`Record`\<`string`, `any`\>\>

The course data if found.

#### Throws

HttpError - If the course is not found or if an error occurs.

***

### update()

> **update**(`params`, `body`): `Promise`\<`Record`\<`string`, `any`\>\>

Defined in: [controllers/CourseController.ts:96](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/CourseController.ts#L96)

Update a course by ID.

#### Parameters

##### params

[`UpdateCourseParams`](../Validators/CourseValidators/UpdateCourseParams.md)

The course ID.

##### body

[`UpdateCourseBody`](../Validators/CourseValidators/UpdateCourseBody.md)

The fields to update.

#### Returns

`Promise`\<`Record`\<`string`, `any`\>\>

The updated course object.

#### Throws

HttpError - If the course is not found or if an error occurs.
