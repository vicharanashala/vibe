Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:138](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L138)

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

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:143](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L143)

MongoDB ID (auto-assigned).

***

### afterItemId?

> `optional` **afterItemId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:183](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L183)

Place item after this item ID (optional).

***

### beforeItemId?

> `optional` **beforeItemId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:191](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L191)

Place item before this item ID (optional).

***

### blogDetails?

> `optional` **blogDetails**: [`BlogDetailsPayloadValidator`](courses.BlogDetailsPayloadValidator.md)

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:228](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L228)

Nested blog details (required if type is BLOG).

***

### createdAt

> **createdAt**: `Date`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:197](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L197)

Item creation timestamp (auto-managed).

***

### description

> **description**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:157](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L157)

Description of the item (required).

#### Implementation of

`IBaseItem.description`

***

### itemDetails

> **itemDetails**: `IVideoDetails` \| `IQuizDetails` \| `IBlogDetails`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:175](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L175)

Item details (depends on type) – video, blog, or quiz.

#### Implementation of

`IBaseItem.itemDetails`

***

### name

> **name**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:150](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L150)

Title of the item (required).

#### Implementation of

`IBaseItem.name`

***

### order

> **order**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:169](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L169)

Order key for item placement (auto-managed).

#### Implementation of

`IBaseItem.order`

***

### quizDetails?

> `optional` **quizDetails**: [`QuizDetailsPayloadValidator`](courses.QuizDetailsPayloadValidator.md)

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:237](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L237)

Nested quiz details (required if type is QUIZ).

***

### sectionId

> **sectionId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:163](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L163)

Section ID to which the item belongs (auto-managed).

***

### type

> **type**: `ItemType`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:210](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L210)

Type of the item: VIDEO, BLOG, or QUIZ.

#### Implementation of

`IBaseItem.type`

***

### updatedAt

> **updatedAt**: `Date`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:203](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L203)

Item update timestamp (auto-managed).

***

### videoDetails?

> `optional` **videoDetails**: [`VideoDetailsPayloadValidator`](courses.VideoDetailsPayloadValidator.md)

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:219](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L219)

Nested video details (required if type is VIDEO).
