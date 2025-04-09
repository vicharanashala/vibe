Defined in: [classes/validators/ItemValidators.ts:131](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L131)

Body for creating an item inside a section.

## Implements

- `IBaseItem`

## Constructors

### Constructor

> **new CreateItemBody**(): `CreateItemBody`

#### Returns

`CreateItemBody`

## Properties

### \_id?

> `optional` **\_id**: `string`

Defined in: [classes/validators/ItemValidators.ts:136](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L136)

MongoDB ID (auto-assigned).

***

### afterItemId?

> `optional` **afterItemId**: `string`

Defined in: [classes/validators/ItemValidators.ts:176](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L176)

Place item after this item ID (optional).

***

### beforeItemId?

> `optional` **beforeItemId**: `string`

Defined in: [classes/validators/ItemValidators.ts:184](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L184)

Place item before this item ID (optional).

***

### blogDetails?

> `optional` **blogDetails**: [`BlogDetailsPayloadValidator`](BlogDetailsPayloadValidator.md)

Defined in: [classes/validators/ItemValidators.ts:221](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L221)

Nested blog details (required if type is BLOG).

***

### createdAt

> **createdAt**: `Date`

Defined in: [classes/validators/ItemValidators.ts:190](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L190)

Item creation timestamp (auto-managed).

***

### description

> **description**: `string`

Defined in: [classes/validators/ItemValidators.ts:150](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L150)

Description of the item (required).

#### Implementation of

`IBaseItem.description`

***

### itemDetails

> **itemDetails**: `IVideoDetails` \| `IQuizDetails` \| `IBlogDetails`

Defined in: [classes/validators/ItemValidators.ts:168](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L168)

Item details (depends on type) – video, blog, or quiz.

#### Implementation of

`IBaseItem.itemDetails`

***

### name

> **name**: `string`

Defined in: [classes/validators/ItemValidators.ts:143](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L143)

Title of the item (required).

#### Implementation of

`IBaseItem.name`

***

### order

> **order**: `string`

Defined in: [classes/validators/ItemValidators.ts:162](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L162)

Order key for item placement (auto-managed).

#### Implementation of

`IBaseItem.order`

***

### quizDetails?

> `optional` **quizDetails**: [`QuizDetailsPayloadValidator`](QuizDetailsPayloadValidator.md)

Defined in: [classes/validators/ItemValidators.ts:230](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L230)

Nested quiz details (required if type is QUIZ).

***

### sectionId

> **sectionId**: `string`

Defined in: [classes/validators/ItemValidators.ts:156](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L156)

Section ID to which the item belongs (auto-managed).

***

### type

> **type**: `ItemType`

Defined in: [classes/validators/ItemValidators.ts:203](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L203)

Type of the item: VIDEO, BLOG, or QUIZ.

#### Implementation of

`IBaseItem.type`

***

### updatedAt

> **updatedAt**: `Date`

Defined in: [classes/validators/ItemValidators.ts:196](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L196)

Item update timestamp (auto-managed).

***

### videoDetails?

> `optional` **videoDetails**: [`VideoDetailsPayloadValidator`](VideoDetailsPayloadValidator.md)

Defined in: [classes/validators/ItemValidators.ts:212](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L212)

Nested video details (required if type is VIDEO).
