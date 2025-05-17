Defined in: [backend/src/modules/courses/controllers/ModuleController.ts:44](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/ModuleController.ts#L44)

Controller for managing modules within a course version.
Handles creation, updating, and reordering of modules.

## Constructors

### Constructor

> **new ModuleController**(`courseRepo`): `ModuleController`

Defined in: [backend/src/modules/courses/controllers/ModuleController.ts:45](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/ModuleController.ts#L45)

#### Parameters

##### courseRepo

`CourseRepository`

#### Returns

`ModuleController`

## Methods

### Courses/Controllers

#### create()

> **create**(`params`, `body`): `Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [backend/src/modules/courses/controllers/ModuleController.ts:68](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/ModuleController.ts#L68)

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

#### delete()

> **delete**(`params`): `Promise`\<\{ `message`: `string`; \}\>

Defined in: [backend/src/modules/courses/controllers/ModuleController.ts:237](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/ModuleController.ts#L237)

Delete a module from a specific course version.

##### Parameters

###### params

[`DeleteModuleParams`](../Validators/CourseVersionValidators/courses.DeleteModuleParams.md)

Parameters including version ID and module ID

##### Returns

`Promise`\<\{ `message`: `string`; \}\>

The deleted module object

##### Throws

BadRequestError if version ID or module ID is missing

##### Throws

HttpError(404) if the module is not found

##### Throws

HttpError(500) for delete errors

***

#### move()

> **move**(`params`, `body`): `Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [backend/src/modules/courses/controllers/ModuleController.ts:170](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/ModuleController.ts#L170)

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

Defined in: [backend/src/modules/courses/controllers/ModuleController.ts:114](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/ModuleController.ts#L114)

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
