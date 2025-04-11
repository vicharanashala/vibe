Defined in: [classes/validators/ModuleValidators.ts:89](https://github.com/saaranshgarg1/vibe/blob/67a31fca9c5546ea9aafedb5fb5b41a5b80e1d53/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L89)

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

Defined in: [classes/validators/ModuleValidators.ts:104](https://github.com/saaranshgarg1/vibe/blob/67a31fca9c5546ea9aafedb5fb5b41a5b80e1d53/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L104)

New description of the module (optional).

#### Implementation of

`Partial.description`

***

### name

> **name**: `string`

Defined in: [classes/validators/ModuleValidators.ts:96](https://github.com/saaranshgarg1/vibe/blob/67a31fca9c5546ea9aafedb5fb5b41a5b80e1d53/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L96)

New name of the module (optional).

#### Implementation of

`Partial.name`

***

### nameOrDescription

> **nameOrDescription**: `string`

Defined in: [classes/validators/ModuleValidators.ts:113](https://github.com/saaranshgarg1/vibe/blob/67a31fca9c5546ea9aafedb5fb5b41a5b80e1d53/backend/src/modules/courses/classes/validators/ModuleValidators.ts#L113)

At least one of `name` or `description` must be provided.
