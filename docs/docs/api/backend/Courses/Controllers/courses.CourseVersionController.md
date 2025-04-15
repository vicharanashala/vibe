Defined in: [backend/src/modules/courses/controllers/CourseVersionController.ts:34](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/controllers/CourseVersionController.ts#L34)

Controller for handling course version operations like creation and retrieval.
All routes are prefixed with `/courses`.

## Constructors

### Constructor

> **new CourseVersionController**(`courseRepo`): `CourseVersionController`

Defined in: [backend/src/modules/courses/controllers/CourseVersionController.ts:35](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/controllers/CourseVersionController.ts#L35)

#### Parameters

##### courseRepo

`CourseRepository`

#### Returns

`CourseVersionController`

## Methods

### Courses/Controllers

#### create()

> **create**(`params`, `body`): `Promise`\<\{ `course`: `Record`\<`string`, `any`\>; `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [backend/src/modules/courses/controllers/CourseVersionController.ts:53](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/controllers/CourseVersionController.ts#L53)

Create a new version for a specific course.

##### Parameters

###### params

[`CreateCourseVersionParams`](../Validators/CourseVersionValidators/courses.CreateCourseVersionParams.md)

Parameters including the course ID (`:id`)

###### body

[`CreateCourseVersionBody`](../Validators/CourseVersionValidators/courses.CreateCourseVersionBody.md)

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

Defined in: [backend/src/modules/courses/controllers/CourseVersionController.ts:104](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/controllers/CourseVersionController.ts#L104)

Retrieve a course version by its ID.

##### Parameters

###### params

[`ReadCourseVersionParams`](../Validators/CourseVersionValidators/courses.ReadCourseVersionParams.md)

Parameters including version ID (`:id`)

##### Returns

`Promise`\<`Record`\<`string`, `any`\>\>

The course version object if found

##### Throws

HttpError(404) if the version is not found

##### Throws

HttpError(500) for read errors
