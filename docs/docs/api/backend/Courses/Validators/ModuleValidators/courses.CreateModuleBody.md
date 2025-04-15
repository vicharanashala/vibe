Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:17](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L17)

Payload for creating a new module inside a course version.

## Implements

- `IModule`

## Constructors

### Constructor

> **new CreateModuleBody**(): `CreateModuleBody`

#### Returns

`CreateModuleBody`

## Properties

### afterModuleId?

> `optional` **afterModuleId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:54](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L54)

Optional: Move the module after this ID.

***

### beforeModuleId?

> `optional` **beforeModuleId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:62](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L62)

Optional: Move the module before this ID.

***

### createdAt

> **createdAt**: `Date`

Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:74](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L74)

Module creation timestamp (auto-managed).

#### Implementation of

`IModule.createdAt`

***

### description

> **description**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:40](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L40)

Detailed description of the module.
Maximum 1000 characters.

#### Implementation of

`IModule.description`

***

### moduleId?

> `optional` **moduleId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:22](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L22)

Unique module ID (auto-generated).

#### Implementation of

`IModule.moduleId`

***

### name

> **name**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:31](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L31)

Name/title of the module.
Maximum 255 characters.

#### Implementation of

`IModule.name`

***

### order

> **order**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:46](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L46)

Order string for module placement (auto-managed).

#### Implementation of

`IModule.order`

***

### sections

> **sections**: `ISection`[]

Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:68](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L68)

Array of section objects (auto-managed).

#### Implementation of

`IModule.sections`

***

### updatedAt

> **updatedAt**: `Date`

Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:80](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L80)

Module update timestamp (auto-managed).

#### Implementation of

`IModule.updatedAt`
