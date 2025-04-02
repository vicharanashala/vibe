Defined in: [controllers/CourseVersionController.ts:25](https://github.com/continuousactivelearning/cal/blob/30fc76483b4a27a3eb2e18b9977ba472853191ce/backend/src/modules/courses/controllers/CourseVersionController.ts#L25)

## Constructors

### Constructor

> **new CourseVersionController**(`courseRepo`): `CourseVersionController`

Defined in: [controllers/CourseVersionController.ts:26](https://github.com/continuousactivelearning/cal/blob/30fc76483b4a27a3eb2e18b9977ba472853191ce/backend/src/modules/courses/controllers/CourseVersionController.ts#L26)

#### Parameters

##### courseRepo

`CourseRepository`

#### Returns

`CourseVersionController`

## Methods

### create()

> **create**(`id`, `payload`): `Promise`\<\{ `course`: `Record`\<`string`, `any`\>; `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [controllers/CourseVersionController.ts:31](https://github.com/continuousactivelearning/cal/blob/30fc76483b4a27a3eb2e18b9977ba472853191ce/backend/src/modules/courses/controllers/CourseVersionController.ts#L31)

#### Parameters

##### id

`string`

##### payload

[`CreateCourseVersionPayloadValidator`](../Validators/CourseVersionValidators/CreateCourseVersionPayloadValidator.md)

#### Returns

`Promise`\<\{ `course`: `Record`\<`string`, `any`\>; `version`: `Record`\<`string`, `any`\>; \}\>

***

### read()

> **read**(`id`): `Promise`\<`Record`\<`string`, `any`\>\>

Defined in: [controllers/CourseVersionController.ts:73](https://github.com/continuousactivelearning/cal/blob/30fc76483b4a27a3eb2e18b9977ba472853191ce/backend/src/modules/courses/controllers/CourseVersionController.ts#L73)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`Record`\<`string`, `any`\>\>
