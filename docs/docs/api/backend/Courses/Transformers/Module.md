Defined in: [classes/transformers/Module.ts:19](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/classes/transformers/Module.ts#L19)

Module data transformation.

## Implements

- `IModule`

## Constructors

### Constructor

> **new Module**(`modulePayload`, `existingModules`): `Module`

Defined in: [classes/transformers/Module.ts:46](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/classes/transformers/Module.ts#L46)

#### Parameters

##### modulePayload

[`CreateModulePayloadValidator`](../Validators/ModuleValidators/CreateModulePayloadValidator.md)

##### existingModules

`IModule`[]

#### Returns

`Module`

## Properties

### createdAt

> **createdAt**: `Date`

Defined in: [classes/transformers/Module.ts:40](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/classes/transformers/Module.ts#L40)

#### Implementation of

`IModule.createdAt`

***

### description

> **description**: `string`

Defined in: [classes/transformers/Module.ts:29](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/classes/transformers/Module.ts#L29)

#### Implementation of

`IModule.description`

***

### moduleId?

> `optional` **moduleId**: `ID`

Defined in: [classes/transformers/Module.ts:23](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/classes/transformers/Module.ts#L23)

#### Implementation of

`IModule.moduleId`

***

### name

> **name**: `string`

Defined in: [classes/transformers/Module.ts:26](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/classes/transformers/Module.ts#L26)

#### Implementation of

`IModule.name`

***

### order

> **order**: `string`

Defined in: [classes/transformers/Module.ts:32](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/classes/transformers/Module.ts#L32)

#### Implementation of

`IModule.order`

***

### sections

> **sections**: [`Section`](Section.md)[]

Defined in: [classes/transformers/Module.ts:36](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/classes/transformers/Module.ts#L36)

#### Implementation of

`IModule.sections`

***

### updatedAt

> **updatedAt**: `Date`

Defined in: [classes/transformers/Module.ts:44](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/classes/transformers/Module.ts#L44)

#### Implementation of

`IModule.updatedAt`
