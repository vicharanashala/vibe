Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:89](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L89)

Payload for updating an existing module.
Supports partial updates.

## Implements

- `Partial`\<`IModule`\>

## Constructors

### Constructor

> **new UpdateModuleBody**(): `UpdateModuleBody`

#### Returns

`UpdateModuleBody`

## Properties

### description

> **description**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:104](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L104)

New description of the module (optional).

#### Implementation of

`Partial.description`

***

### name

> **name**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:96](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L96)

New name of the module (optional).

#### Implementation of

`Partial.name`

***

### nameOrDescription

> **nameOrDescription**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ModuleValidators.ts:113](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L113)

At least one of `name` or `description` must be provided.
