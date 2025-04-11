Defined in: [classes/validators/ItemValidators.ts:346](https://github.com/saaranshgarg1/vibe/blob/67a31fca9c5546ea9aafedb5fb5b41a5b80e1d53/backend/src/modules/courses/classes/validators/ItemValidators.ts#L346)

Body to move an item within its section.

## Constructors

### Constructor

> **new MoveItemBody**(): `MoveItemBody`

#### Returns

`MoveItemBody`

## Properties

### afterItemId?

> `optional` **afterItemId**: `string`

Defined in: [classes/validators/ItemValidators.ts:353](https://github.com/saaranshgarg1/vibe/blob/67a31fca9c5546ea9aafedb5fb5b41a5b80e1d53/backend/src/modules/courses/classes/validators/ItemValidators.ts#L353)

Move after this item (optional).

***

### beforeItemId?

> `optional` **beforeItemId**: `string`

Defined in: [classes/validators/ItemValidators.ts:361](https://github.com/saaranshgarg1/vibe/blob/67a31fca9c5546ea9aafedb5fb5b41a5b80e1d53/backend/src/modules/courses/classes/validators/ItemValidators.ts#L361)

Move before this item (optional).

***

### bothNotAllowed

> **bothNotAllowed**: `string`

Defined in: [classes/validators/ItemValidators.ts:379](https://github.com/saaranshgarg1/vibe/blob/67a31fca9c5546ea9aafedb5fb5b41a5b80e1d53/backend/src/modules/courses/classes/validators/ItemValidators.ts#L379)

Validation helper – both afterItemId and beforeItemId cannot be present at the same time.

***

### onlyOneAllowed

> **onlyOneAllowed**: `string`

Defined in: [classes/validators/ItemValidators.ts:370](https://github.com/saaranshgarg1/vibe/blob/67a31fca9c5546ea9aafedb5fb5b41a5b80e1d53/backend/src/modules/courses/classes/validators/ItemValidators.ts#L370)

Validation helper – at least one of afterItemId or beforeItemId must be present.
