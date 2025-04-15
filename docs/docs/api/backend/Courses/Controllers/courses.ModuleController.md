Defined in: [backend/src/modules/courses/controllers/ModuleController.ts:39](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/controllers/ModuleController.ts#L39)

Controller for managing modules within a course version.
Handles creation, updating, and reordering of modules.

## Constructors

### Constructor

> **new ModuleController**(`courseRepo`): `ModuleController`

Defined in: [backend/src/modules/courses/controllers/ModuleController.ts:40](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/controllers/ModuleController.ts#L40)

#### Parameters

##### courseRepo

`CourseRepository`

#### Returns

`ModuleController`

## Methods

### Courses/Controllers

#### create()

> **create**(`params`, `body`): `Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [backend/src/modules/courses/controllers/ModuleController.ts:62](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/controllers/ModuleController.ts#L62)

Create a new module under a specific course version.

##### Parameters

###### params

[`CreateModuleParams`](../Validators/ModuleValidators/courses.CreateModuleParams.md)

Route parameters including the course version ID.

###### body

[`CreateModuleBody`](../Validators/ModuleValidators/courses.CreateModuleBody.md)

Payload containing module name, description, etc.

##### Returns

`Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

The updated course version with the new module.

##### Throws

InternalServerError on any failure during module creation.

***

#### move()

> **move**(`params`, `body`): `Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [backend/src/modules/courses/controllers/ModuleController.ts:164](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/controllers/ModuleController.ts#L164)

Reorder a module within its course version.
The new position is determined using beforeModuleId or afterModuleId.

##### Parameters

###### params

[`MoveModuleParams`](../Validators/ModuleValidators/courses.MoveModuleParams.md)

Route parameters including versionId and moduleId.

###### body

[`MoveModuleBody`](../Validators/ModuleValidators/courses.MoveModuleBody.md)

Positioning details: beforeModuleId or afterModuleId.

##### Returns

`Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

The updated course version with modules in new order.

##### Throws

UpdateError if neither beforeModuleId nor afterModuleId is provided.

##### Throws

HTTPError(500) for other internal errors.

***

#### update()

> **update**(`params`, `body`): `Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [backend/src/modules/courses/controllers/ModuleController.ts:108](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/controllers/ModuleController.ts#L108)

Update an existing module's name or description.

##### Parameters

###### params

[`UpdateModuleParams`](../Validators/ModuleValidators/courses.UpdateModuleParams.md)

Route parameters including versionId and moduleId.

###### body

[`UpdateModuleBody`](../Validators/ModuleValidators/courses.UpdateModuleBody.md)

Fields to update such as name and/or description.

##### Returns

`Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

The updated course version.

##### Throws

HTTPError(404) if the module is not found.
