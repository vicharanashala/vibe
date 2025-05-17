Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:17](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L17)

Payload for creating a new module inside a course version.

## Implements

- `Partial`\<`IModule`\>

## Constructors

### Constructor

> **new CreateModuleBody**(): `CreateModuleBody`

#### Returns

`CreateModuleBody`

## Properties

### afterModuleId?

> `optional` **afterModuleId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:42](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L42)

Optional: Move the module after this ID.

***

### beforeModuleId?

> `optional` **beforeModuleId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:50](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L50)

Optional: Move the module before this ID.

***

### description

> **description**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:34](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L34)

Detailed description of the module.
Maximum 1000 characters.

#### Implementation of

`Partial.description`

***

### name

> **name**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:25](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L25)

Name/title of the module.
Maximum 255 characters.

#### Implementation of

`Partial.name`
