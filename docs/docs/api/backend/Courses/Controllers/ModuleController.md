Defined in: [controllers/ModuleController.ts:34](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/controllers/ModuleController.ts#L34)

## Constructors

### Constructor

> **new ModuleController**(`courseRepo`): `ModuleController`

Defined in: [controllers/ModuleController.ts:35](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/controllers/ModuleController.ts#L35)

#### Parameters

##### courseRepo

`CourseRepository`

#### Returns

`ModuleController`

## Methods

### create()

> **create**(`params`, `payload`): `Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [controllers/ModuleController.ts:44](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/controllers/ModuleController.ts#L44)

#### Parameters

##### params

[`CreateParams`](../../Other/CreateParams.md)

##### payload

[`CreateModulePayloadValidator`](../Validators/ModuleValidators/CreateModulePayloadValidator.md)

#### Returns

`Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

***

### move()

> **move**(`versionId`, `moduleId`, `body`): `Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [controllers/ModuleController.ts:119](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/controllers/ModuleController.ts#L119)

#### Parameters

##### versionId

`string`

##### moduleId

`string`

##### body

###### afterModuleId?

`string`

###### beforeModuleId?

`string`

#### Returns

`Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

***

### update()

> **update**(`versionId`, `moduleId`, `payload`): `Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [controllers/ModuleController.ts:77](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/controllers/ModuleController.ts#L77)

#### Parameters

##### versionId

`string`

##### moduleId

`string`

##### payload

`Partial`\<[`CreateModulePayloadValidator`](../Validators/ModuleValidators/CreateModulePayloadValidator.md)\>

#### Returns

`Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>
