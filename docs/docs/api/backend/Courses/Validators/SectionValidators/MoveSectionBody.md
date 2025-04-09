Defined in: [classes/validators/SectionValidators.ts:122](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/SectionValidators.ts#L122)

Payload for reordering a section within a module.

## Constructors

### Constructor

> **new MoveSectionBody**(): `MoveSectionBody`

#### Returns

`MoveSectionBody`

## Properties

### afterSectionId?

> `optional` **afterSectionId**: `string`

Defined in: [classes/validators/SectionValidators.ts:129](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/SectionValidators.ts#L129)

Optional: move after this section ID.

***

### beforeSectionId?

> `optional` **beforeSectionId**: `string`

Defined in: [classes/validators/SectionValidators.ts:137](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/SectionValidators.ts#L137)

Optional: move before this section ID.

***

### bothNotAllowed

> **bothNotAllowed**: `string`

Defined in: [classes/validators/SectionValidators.ts:157](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/SectionValidators.ts#L157)

Validation helper — only one of before/after should be used.

***

### onlyOneAllowed

> **onlyOneAllowed**: `string`

Defined in: [classes/validators/SectionValidators.ts:147](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/SectionValidators.ts#L147)

Validation helper — at least one position ID must be provided.
