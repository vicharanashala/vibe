Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:18](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/SectionValidators.ts#L18)

Payload for creating a section inside a module.

## Implements

- `ISection`

## Constructors

### Constructor

> **new CreateSectionBody**(): `CreateSectionBody`

#### Returns

`CreateSectionBody`

## Properties

### afterSectionId?

> `optional` **afterSectionId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:55](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/SectionValidators.ts#L55)

Optional: place the section after this section ID.

***

### beforeSectionId?

> `optional` **beforeSectionId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:63](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/SectionValidators.ts#L63)

Optional: place the section before this section ID.

***

### createdAt

> **createdAt**: `Date`

Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:75](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/SectionValidators.ts#L75)

Creation timestamp (auto-managed).

#### Implementation of

`ISection.createdAt`

***

### description

> **description**: `string`

Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:41](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/SectionValidators.ts#L41)

Description or purpose of the section.
Maximum 1000 characters.

#### Implementation of

`ISection.description`

***

### itemsGroupId?

> `optional` **itemsGroupId**: `ID`

Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:69](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/SectionValidators.ts#L69)

ItemsGroup ID associated with this section (auto-managed).

#### Implementation of

`ISection.itemsGroupId`

***

### name

> **name**: `string`

Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:32](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/SectionValidators.ts#L32)

Name/title of the section.
Maximum 255 characters.

#### Implementation of

`ISection.name`

***

### order

> **order**: `string`

Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:47](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/SectionValidators.ts#L47)

Order string for section placement (auto-managed).

#### Implementation of

`ISection.order`

***

### sectionId?

> `optional` **sectionId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:23](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/SectionValidators.ts#L23)

Unique section ID (auto-generated).

#### Implementation of

`ISection.sectionId`

***

### updatedAt

> **updatedAt**: `Date`

Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:81](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/courses/classes/validators/SectionValidators.ts#L81)

Last updated timestamp (auto-managed).

#### Implementation of

`ISection.updatedAt`
