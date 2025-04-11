Defined in: [controllers/ItemController.ts:41](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/ItemController.ts#L41)

Controller for managing items within course modules and sections.
Handles operations such as creation, retrieval, update, and reordering.

## Constructors

### Constructor

> **new ItemController**(`courseRepo`): `ItemController`

Defined in: [controllers/ItemController.ts:42](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/ItemController.ts#L42)

#### Parameters

##### courseRepo

`CourseRepository`

#### Returns

`ItemController`

## Methods

### Courses/Controllers

#### create()

> **create**(`params`, `body`): `Promise`\<\{ `itemsGroup`: `Record`\<`string`, `any`\>; `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [controllers/ItemController.ts:64](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/ItemController.ts#L64)

Create a new item under a specific section of a module in a course version.

##### Parameters

###### params

[`CreateItemParams`](../Validators/ItemValidators/CreateItemParams.md)

Route parameters including versionId, moduleId, and sectionId.

###### body

[`CreateItemBody`](../Validators/ItemValidators/CreateItemBody.md)

The item data to be created.

##### Returns

`Promise`\<\{ `itemsGroup`: `Record`\<`string`, `any`\>; `version`: `Record`\<`string`, `any`\>; \}\>

The updated itemsGroup and version.

##### Throws

HTTPError(500) on internal errors.

***

#### move()

> **move**(`params`, `body`): `Promise`\<\{ `itemsGroup`: `Record`\<`string`, `any`\>; `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [controllers/ItemController.ts:269](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/ItemController.ts#L269)

Move an item to a new position within a section by recalculating its order.

##### Parameters

###### params

[`MoveItemParams`](../Validators/ItemValidators/MoveItemParams.md)

Route parameters including versionId, moduleId, sectionId, and itemId.

###### body

[`MoveItemBody`](../Validators/ItemValidators/MoveItemBody.md)

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

> **readAll**(`params`): `Promise`\<\{ `itemsGroup`: [`ItemsGroup`](../Transformers/ItemsGroup.md); \}\>

Defined in: [controllers/ItemController.ts:134](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/ItemController.ts#L134)

Retrieve all items from a section of a module in a course version.

##### Parameters

###### params

[`ReadAllItemsParams`](../Validators/ItemValidators/ReadAllItemsParams.md)

Route parameters including versionId, moduleId, and sectionId.

##### Returns

`Promise`\<\{ `itemsGroup`: [`ItemsGroup`](../Transformers/ItemsGroup.md); \}\>

The list of items within the section.

##### Throws

HTTPError(500) on internal errors.

***

#### update()

> **update**(`params`, `body`): `Promise`\<\{ `itemsGroup`: `Record`\<`string`, `any`\>; `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [controllers/ItemController.ts:177](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/ItemController.ts#L177)

Update an existing item in a section of a module in a course version.

##### Parameters

###### params

[`UpdateItemParams`](../Validators/ItemValidators/UpdateItemParams.md)

Route parameters including versionId, moduleId, sectionId, and itemId.

###### body

[`UpdateItemBody`](../Validators/ItemValidators/UpdateItemBody.md)

Fields to update, including name, description, type, and itemDetails.

##### Returns

`Promise`\<\{ `itemsGroup`: `Record`\<`string`, `any`\>; `version`: `Record`\<`string`, `any`\>; \}\>

The updated itemsGroup and version.

##### Throws

HTTPError(500) on internal errors.
