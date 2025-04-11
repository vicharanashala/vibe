Defined in: [controllers/CourseVersionController.ts:34](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/CourseVersionController.ts#L34)

Controller for handling course version operations like creation and retrieval.
All routes are prefixed with `/courses`.

## Constructors

### Constructor

> **new CourseVersionController**(`courseRepo`): `CourseVersionController`

Defined in: [controllers/CourseVersionController.ts:35](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/CourseVersionController.ts#L35)

#### Parameters

##### courseRepo

`CourseRepository`

#### Returns

`CourseVersionController`

## Methods

### Courses/Controllers

#### create()

> **create**(`params`, `body`): `Promise`\<\{ `course`: `Record`\<`string`, `any`\>; `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [controllers/CourseVersionController.ts:53](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/CourseVersionController.ts#L53)

Create a new version for a specific course.

##### Parameters

###### params

[`CreateCourseVersionParams`](../Validators/CourseVersionValidators/CreateCourseVersionParams.md)

Parameters including the course ID (`:id`)

###### body

[`CreateCourseVersionBody`](../Validators/CourseVersionValidators/CreateCourseVersionBody.md)

Payload containing version name and description

##### Returns

`Promise`\<\{ `course`: `Record`\<`string`, `any`\>; `version`: `Record`\<`string`, `any`\>; \}\>

The updated course and the newly created version

##### Throws

HttpError(404) if the course is not found

##### Throws

HttpError(500) on any other internal error

***

#### read()

> **read**(`params`): `Promise`\<`Record`\<`string`, `any`\>\>

Defined in: [controllers/CourseVersionController.ts:100](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/CourseVersionController.ts#L100)

Retrieve a course version by its ID.

##### Parameters

###### params

[`ReadCourseVersionParams`](../Validators/CourseVersionValidators/ReadCourseVersionParams.md)

Parameters including version ID (`:id`)

##### Returns

`Promise`\<`Record`\<`string`, `any`\>\>

The course version object if found

##### Throws

HttpError(404) if the version is not found

##### Throws

HttpError(500) for read errors
