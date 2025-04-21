Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:239](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ItemValidators.ts#L239)

Body for updating an item.
Allows partial updates to name, description, and details.

## Implements

- `IBaseItem`

## Constructors

### Constructor

> **new UpdateItemBody**(): `UpdateItemBody`

#### Returns

`UpdateItemBody`

## Properties

### \_id?

> `optional` **\_id**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:244](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ItemValidators.ts#L244)

MongoDB ID of the item (auto-managed).

***

### afterItemId?

> `optional` **afterItemId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:303](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ItemValidators.ts#L303)

Optional: reorder after this item.

***

### beforeItemId?

> `optional` **beforeItemId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:311](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ItemValidators.ts#L311)

Optional: reorder before this item.

***

### blogDetails?

> `optional` **blogDetails**: [`BlogDetailsPayloadValidator`](courses.BlogDetailsPayloadValidator.md)

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:329](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ItemValidators.ts#L329)

Updated blog details (if type is BLOG).

***

### createdAt

> **createdAt**: `Date`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:282](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ItemValidators.ts#L282)

Created at timestamp (auto-managed).

***

### description

> **description**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:258](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ItemValidators.ts#L258)

Updated description (optional).

#### Implementation of

`IBaseItem.description`

***

### itemDetails

> **itemDetails**: `IVideoDetails` \| `IQuizDetails` \| `IBlogDetails`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:276](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ItemValidators.ts#L276)

Item details (auto-managed).

#### Implementation of

`IBaseItem.itemDetails`

***

### name

> **name**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:251](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ItemValidators.ts#L251)

Updated name (optional).

#### Implementation of

`IBaseItem.name`

***

### order

> **order**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:270](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ItemValidators.ts#L270)

Order (auto-managed).

#### Implementation of

`IBaseItem.order`

***

### quizDetails?

> `optional` **quizDetails**: [`QuizDetailsPayloadValidator`](courses.QuizDetailsPayloadValidator.md)

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:338](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ItemValidators.ts#L338)

Updated quiz details (if type is QUIZ).

***

### sectionId

> **sectionId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:264](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ItemValidators.ts#L264)

Section ID (auto-managed).

***

### type

> **type**: `ItemType`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:295](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ItemValidators.ts#L295)

Updated type, if changing item category.

#### Implementation of

`IBaseItem.type`

***

### updatedAt

> **updatedAt**: `Date`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:288](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ItemValidators.ts#L288)

Updated at timestamp (auto-managed).

***

### videoDetails?

> `optional` **videoDetails**: [`VideoDetailsPayloadValidator`](courses.VideoDetailsPayloadValidator.md)

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:320](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/ItemValidators.ts#L320)

Updated video details (if type is VIDEO).
