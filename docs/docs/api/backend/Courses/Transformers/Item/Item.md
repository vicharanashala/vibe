Defined in: [classes/transformers/Item.ts:23](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/classes/transformers/Item.ts#L23)

Item data transformation.

## Implements

- `IBaseItem`

## Constructors

### Constructor

> **new Item**(`itemPayload`, `existingItems`): `Item`

Defined in: [classes/transformers/Item.ts:43](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/classes/transformers/Item.ts#L43)

#### Parameters

##### itemPayload

[`CreateItemPayloadValidator`](../../Validators/ItemValidators/CreateItemPayloadValidator.md)

##### existingItems

`Item`[]

#### Returns

`Item`

## Properties

### description

> **description**: `string`

Defined in: [classes/transformers/Item.ts:33](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/classes/transformers/Item.ts#L33)

#### Implementation of

`IBaseItem.description`

***

### itemDetails

> **itemDetails**: `IVideoDetails` \| `IQuizDetails` \| `IBlogDetails`

Defined in: [classes/transformers/Item.ts:41](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/classes/transformers/Item.ts#L41)

#### Implementation of

`IBaseItem.itemDetails`

***

### itemId?

> `optional` **itemId**: `ID`

Defined in: [classes/transformers/Item.ts:27](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/classes/transformers/Item.ts#L27)

#### Implementation of

`IBaseItem.itemId`

***

### name

> **name**: `string`

Defined in: [classes/transformers/Item.ts:30](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/classes/transformers/Item.ts#L30)

#### Implementation of

`IBaseItem.name`

***

### order

> **order**: `string`

Defined in: [classes/transformers/Item.ts:39](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/classes/transformers/Item.ts#L39)

#### Implementation of

`IBaseItem.order`

***

### type

> **type**: `ItemType`

Defined in: [classes/transformers/Item.ts:36](https://github.com/continuousactivelearning/cal/blob/82a7f7bd547282a4f223f46ab6c2efe92f30e4ce/backend/src/modules/courses/classes/transformers/Item.ts#L36)

#### Implementation of

`IBaseItem.type`
