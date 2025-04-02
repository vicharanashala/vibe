Defined in: [controllers/CourseController.ts:28](https://github.com/continuousactivelearning/cal/blob/30fc76483b4a27a3eb2e18b9977ba472853191ce/backend/src/modules/courses/controllers/CourseController.ts#L28)

## Constructors

### Constructor

> **new CourseController**(`courseRepo`): `CourseController`

Defined in: [controllers/CourseController.ts:29](https://github.com/continuousactivelearning/cal/blob/30fc76483b4a27a3eb2e18b9977ba472853191ce/backend/src/modules/courses/controllers/CourseController.ts#L29)

#### Parameters

##### courseRepo

`CourseRepository`

#### Returns

`CourseController`

## Methods

### create()

> **create**(`payload`): `Promise`\<`Record`\<`string`, `any`\>\>

Defined in: [controllers/CourseController.ts:35](https://github.com/continuousactivelearning/cal/blob/30fc76483b4a27a3eb2e18b9977ba472853191ce/backend/src/modules/courses/controllers/CourseController.ts#L35)

#### Parameters

##### payload

[`CreateCoursePayloadValidator`](../Validators/CourseValidators/CreateCoursePayloadValidator.md)

#### Returns

`Promise`\<`Record`\<`string`, `any`\>\>

***

### read()

> **read**(`id`): `Promise`\<`Record`\<`string`, `any`\>\>

Defined in: [controllers/CourseController.ts:47](https://github.com/continuousactivelearning/cal/blob/30fc76483b4a27a3eb2e18b9977ba472853191ce/backend/src/modules/courses/controllers/CourseController.ts#L47)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`Record`\<`string`, `any`\>\>

***

### update()

> **update**(`id`, `payload`): `Promise`\<`Record`\<`string`, `any`\>\>

Defined in: [controllers/CourseController.ts:61](https://github.com/continuousactivelearning/cal/blob/30fc76483b4a27a3eb2e18b9977ba472853191ce/backend/src/modules/courses/controllers/CourseController.ts#L61)

#### Parameters

##### id

`string`

##### payload

[`UpdateCoursePayloadValidator`](../Validators/CourseValidators/UpdateCoursePayloadValidator.md)

#### Returns

`Promise`\<`Record`\<`string`, `any`\>\>
