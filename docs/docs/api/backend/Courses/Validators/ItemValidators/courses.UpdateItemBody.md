Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:246](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L246)

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

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:251](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L251)

MongoDB ID of the item (auto-managed).

***

### afterItemId?

> `optional` **afterItemId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:310](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L310)

Optional: reorder after this item.

***

### beforeItemId?

> `optional` **beforeItemId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:318](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L318)

Optional: reorder before this item.

***

### blogDetails?

> `optional` **blogDetails**: [`BlogDetailsPayloadValidator`](courses.BlogDetailsPayloadValidator.md)

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:336](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L336)

Updated blog details (if type is BLOG).

***

### createdAt

> **createdAt**: `Date`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:289](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L289)

Created at timestamp (auto-managed).

***

### description

> **description**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:265](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L265)

Updated description (optional).

#### Implementation of

`IBaseItem.description`

***

### itemDetails

> **itemDetails**: `IVideoDetails` \| `IQuizDetails` \| `IBlogDetails`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:283](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L283)

Item details (auto-managed).

#### Implementation of

`IBaseItem.itemDetails`

***

### name

> **name**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:258](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L258)

Updated name (optional).

#### Implementation of

`IBaseItem.name`

***

### order

> **order**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:277](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L277)

Order (auto-managed).

#### Implementation of

`IBaseItem.order`

***

### quizDetails?

> `optional` **quizDetails**: [`QuizDetailsPayloadValidator`](courses.QuizDetailsPayloadValidator.md)

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:345](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L345)

Updated quiz details (if type is QUIZ).

***

### sectionId

> **sectionId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:271](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L271)

Section ID (auto-managed).

***

### type

> **type**: `ItemType`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:302](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L302)

Updated type, if changing item category.

#### Implementation of

`IBaseItem.type`

***

### updatedAt

> **updatedAt**: `Date`

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:295](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L295)

Updated at timestamp (auto-managed).

***

### videoDetails?

> `optional` **videoDetails**: [`VideoDetailsPayloadValidator`](courses.VideoDetailsPayloadValidator.md)

Defined in: [backend/src/modules/courses/classes/validators/ItemValidators.ts:327](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/ItemValidators.ts#L327)

Updated video details (if type is VIDEO).
