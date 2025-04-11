Defined in: [classes/transformers/Course.ts:18](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/transformers/Course.ts#L18)

Course data transformation.

## Implements

- `ICourse`

## Constructors

### Constructor

> **new Course**(`courseBody`?): `Course`

Defined in: [classes/transformers/Course.ts:48](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/transformers/Course.ts#L48)

#### Parameters

##### courseBody?

[`CreateCourseBody`](../Validators/CourseValidators/CreateCourseBody.md)

#### Returns

`Course`

## Properties

### \_id?

> `optional` **\_id**: `ID`

Defined in: [classes/transformers/Course.ts:22](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/transformers/Course.ts#L22)

#### Implementation of

`ICourse._id`

***

### createdAt?

> `optional` **createdAt**: `Date`

Defined in: [classes/transformers/Course.ts:42](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/transformers/Course.ts#L42)

#### Implementation of

`ICourse.createdAt`

***

### description

> **description**: `string`

Defined in: [classes/transformers/Course.ts:28](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/transformers/Course.ts#L28)

#### Implementation of

`ICourse.description`

***

### instructors

> **instructors**: `ID`[]

Defined in: [classes/transformers/Course.ts:38](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/transformers/Course.ts#L38)

#### Implementation of

`ICourse.instructors`

***

### name

> **name**: `string`

Defined in: [classes/transformers/Course.ts:25](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/transformers/Course.ts#L25)

#### Implementation of

`ICourse.name`

***

### updatedAt?

> `optional` **updatedAt**: `Date`

Defined in: [classes/transformers/Course.ts:46](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/transformers/Course.ts#L46)

#### Implementation of

`ICourse.updatedAt`

***

### versions

> **versions**: `ID`[]

Defined in: [classes/transformers/Course.ts:33](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/transformers/Course.ts#L33)

#### Implementation of

`ICourse.versions`
