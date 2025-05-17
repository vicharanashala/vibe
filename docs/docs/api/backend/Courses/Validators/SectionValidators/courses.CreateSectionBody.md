Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:18](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/SectionValidators.ts#L18)

Payload for creating a section inside a module.

## Implements

- `Partial`\<`ISection`\>

## Constructors

### Constructor

> **new CreateSectionBody**(): `CreateSectionBody`

#### Returns

`CreateSectionBody`

## Properties

### afterSectionId?

> `optional` **afterSectionId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:43](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/SectionValidators.ts#L43)

Optional: place the section after this section ID.

***

### beforeSectionId?

> `optional` **beforeSectionId**: `string`

Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:51](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/SectionValidators.ts#L51)

Optional: place the section before this section ID.

***

### description

> **description**: `string`

Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:35](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/SectionValidators.ts#L35)

Description or purpose of the section.
Maximum 1000 characters.

#### Implementation of

`Partial.description`

***

### name

> **name**: `string`

Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:26](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/classes/validators/SectionValidators.ts#L26)

Name/title of the section.
Maximum 255 characters.

#### Implementation of

`Partial.name`
