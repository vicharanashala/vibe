Defined in: [backend/src/modules/courses/controllers/CourseVersionController.ts:39](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/CourseVersionController.ts#L39)

Controller for handling course version operations like creation and retrieval.
All routes are prefixed with `/courses`.

## Constructors

### Constructor

> **new CourseVersionController**(`courseRepo`): `CourseVersionController`

Defined in: [backend/src/modules/courses/controllers/CourseVersionController.ts:40](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/CourseVersionController.ts#L40)

#### Parameters

##### courseRepo

`CourseRepository`

#### Returns

`CourseVersionController`

## Methods

### Courses/Controllers

#### create()

> **create**(`params`, `body`): `Promise`\<\{ `course`: `Record`\<`string`, `any`\>; `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [backend/src/modules/courses/controllers/CourseVersionController.ts:59](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/CourseVersionController.ts#L59)

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

#### delete()

> **delete**(`params`): `Promise`\<\{ `message`: `string`; \}\>

Defined in: [backend/src/modules/courses/controllers/CourseVersionController.ts:139](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/CourseVersionController.ts#L139)

Delete the course version by its ID

##### Parameters

###### params

[`DeleteCourseVersionParams`](../Validators/CourseVersionValidators/courses.DeleteCourseVersionParams.md)

##### Returns

`Promise`\<\{ `message`: `string`; \}\>

The deleted course version object.

##### Params

params - Parameters including the courseID and version ID.

##### Throws

HttpError(404) if the course or version is not found.

##### Throws

HttpError(500) on any other internal server errors.

***

#### read()

> **read**(`params`): `Promise`\<`Record`\<`string`, `any`\>\>

Defined in: [backend/src/modules/courses/controllers/CourseVersionController.ts:110](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/CourseVersionController.ts#L110)

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
