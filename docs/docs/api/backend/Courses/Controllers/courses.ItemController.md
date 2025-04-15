Defined in: [backend/src/modules/courses/controllers/ItemController.ts:44](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/controllers/ItemController.ts#L44)

Controller for managing items within course modules and sections.
Handles operations such as creation, retrieval, update, and reordering.

## Constructors

### Constructor

> **new ItemController**(`courseRepo`): `ItemController`

Defined in: [backend/src/modules/courses/controllers/ItemController.ts:45](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/controllers/ItemController.ts#L45)

#### Parameters

##### courseRepo

`CourseRepository`

#### Returns

`ItemController`

## Methods

### Courses/Controllers

#### create()

> **create**(`params`, `body`): `Promise`\<\{ `itemsGroup`: `Record`\<`string`, `any`\>; `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [backend/src/modules/courses/controllers/ItemController.ts:67](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/controllers/ItemController.ts#L67)

Create a new item under a specific section of a module in a course version.

##### Parameters

###### params

[`CreateItemParams`](../Validators/ItemValidators/courses.CreateItemParams.md)

Route parameters including versionId, moduleId, and sectionId.

###### body

[`CreateItemBody`](../Validators/ItemValidators/courses.CreateItemBody.md)

The item data to be created.

##### Returns

`Promise`\<\{ `itemsGroup`: `Record`\<`string`, `any`\>; `version`: `Record`\<`string`, `any`\>; \}\>

The updated itemsGroup and version.

##### Throws

HTTPError(500) on internal errors.

***

#### delete()

> **delete**(`params`): `Promise`\<\{ `deletedItem`: `Record`\<`string`, `any`\>; `updatedItemsGroup`: `Record`\<`string`, `any`\>; \}\>

Defined in: [backend/src/modules/courses/controllers/ItemController.ts:266](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/controllers/ItemController.ts#L266)

Delete an item from a section of a module in a course version.

##### Parameters

###### params

[`DeleteItemParams`](../Validators/ItemValidators/courses.DeleteItemParams.md)

Route parameters including versionId, moduleId, sectionId, and itemId.

##### Returns

`Promise`\<\{ `deletedItem`: `Record`\<`string`, `any`\>; `updatedItemsGroup`: `Record`\<`string`, `any`\>; \}\>

The updated itemsGroup and version.

##### Throw

HTTPError(500) on internal errors.

***

#### move()

> **move**(`params`, `body`): `Promise`\<\{ `itemsGroup`: `Record`\<`string`, `any`\>; `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [backend/src/modules/courses/controllers/ItemController.ts:333](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/controllers/ItemController.ts#L333)

Move an item to a new position within a section by recalculating its order.

##### Parameters

###### params

[`MoveItemParams`](../Validators/ItemValidators/courses.MoveItemParams.md)

Route parameters including versionId, moduleId, sectionId, and itemId.

###### body

[`MoveItemBody`](../Validators/ItemValidators/courses.MoveItemBody.md)

Movement instructions including `afterItemId` or `beforeItemId`.

##### Returns

`Promise`\<\{ `itemsGroup`: `Record`\<`string`, `any`\>; `version`: `Record`\<`string`, `any`\>; \}\>

The updated itemsGroup and version.

##### Throws

BadRequestError if both afterItemId and beforeItemId are missing.

##### Throws

HTTPError(500) on internal errors.

***

#### readAll()

> **readAll**(`params`): `Promise`\<\{ `itemsGroup`: [`ItemsGroup`](../Transformers/courses.ItemsGroup.md); \}\>

Defined in: [backend/src/modules/courses/controllers/ItemController.ts:138](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/controllers/ItemController.ts#L138)

Retrieve all items from a section of a module in a course version.

##### Parameters

###### params

[`ReadAllItemsParams`](../Validators/ItemValidators/courses.ReadAllItemsParams.md)

Route parameters including versionId, moduleId, and sectionId.

##### Returns

`Promise`\<\{ `itemsGroup`: [`ItemsGroup`](../Transformers/courses.ItemsGroup.md); \}\>

The list of items within the section.

##### Throws

HTTPError(500) on internal errors.

***

#### update()

> **update**(`params`, `body`): `Promise`\<\{ `itemsGroup`: `Record`\<`string`, `any`\>; `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [backend/src/modules/courses/controllers/ItemController.ts:181](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/controllers/ItemController.ts#L181)

Update an existing item in a section of a module in a course version.

##### Parameters

###### params

[`UpdateItemParams`](../Validators/ItemValidators/courses.UpdateItemParams.md)

Route parameters including versionId, moduleId, sectionId, and itemId.

###### body

[`UpdateItemBody`](../Validators/ItemValidators/courses.UpdateItemBody.md)

Fields to update, including name, description, type, and itemDetails.

##### Returns

`Promise`\<\{ `itemsGroup`: `Record`\<`string`, `any`\>; `version`: `Record`\<`string`, `any`\>; \}\>

The updated itemsGroup and version.

##### Throws

HTTPError(500) on internal errors.
