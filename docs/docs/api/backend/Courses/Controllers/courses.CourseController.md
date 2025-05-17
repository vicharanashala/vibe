Defined in: [backend/src/modules/courses/controllers/CourseController.ts:41](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/CourseController.ts#L41)

Controller for managing courses.
Handles API endpoints related to course creation, reading, and updating.
Uses dependency injection to work with CourseRepository and exposes
endpoints under the `/courses` route.

## Constructors

### Constructor

> **new CourseController**(`courseRepo`): `CourseController`

Defined in: [backend/src/modules/courses/controllers/CourseController.ts:42](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/CourseController.ts#L42)

#### Parameters

##### courseRepo

`CourseRepository`

#### Returns

`CourseController`

## Methods

### create()

> **create**(`body`): `Promise`\<[`Course`](../Transformers/courses.Course.md)\>

Defined in: [backend/src/modules/courses/controllers/CourseController.ts:56](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/CourseController.ts#L56)

Create a new course.

#### Parameters

##### body

[`CreateCourseBody`](../Validators/CourseValidators/courses.CreateCourseBody.md)

Validated payload for course creation.

#### Returns

`Promise`\<[`Course`](../Transformers/courses.Course.md)\>

The created course object.

#### Throws

HttpError - If the course creation fails.

***

### read()

> **read**(`params`): `Promise`\<`Record`\<`string`, `any`\>\>

Defined in: [backend/src/modules/courses/controllers/CourseController.ts:75](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/CourseController.ts#L75)

Retrieve a course by its ID.

#### Parameters

##### params

[`ReadCourseParams`](../Validators/CourseValidators/courses.ReadCourseParams.md)

Contains the course Mongo ID.

#### Returns

`Promise`\<`Record`\<`string`, `any`\>\>

The course data if found.

#### Throws

HttpError - If the course is not found or if an error occurs.

***

### update()

> **update**(`params`, `body`): `Promise`\<`Record`\<`string`, `any`\>\>

Defined in: [backend/src/modules/courses/controllers/CourseController.ts:98](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/CourseController.ts#L98)

Update a course by ID.

#### Parameters

##### params

[`UpdateCourseParams`](../Validators/CourseValidators/courses.UpdateCourseParams.md)

The course ID.

##### body

[`UpdateCourseBody`](../Validators/CourseValidators/courses.UpdateCourseBody.md)

The fields to update.

#### Returns

`Promise`\<`Record`\<`string`, `any`\>\>

The updated course object.

#### Throws

HttpError - If the course is not found or if an error occurs.
