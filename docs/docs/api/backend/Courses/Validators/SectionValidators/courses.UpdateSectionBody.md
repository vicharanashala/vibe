Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:90](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/classes/validators/SectionValidators.ts#L90)

Payload for updating a section.
Allows partial updates to name or description.

## Implements

- `Partial`\<`ISection`\>

## Constructors

### Constructor

> **new UpdateSectionBody**(): `UpdateSectionBody`

#### Returns

`UpdateSectionBody`

## Properties

### description

> **description**: `string`

Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:105](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/classes/validators/SectionValidators.ts#L105)

New description of the section (optional).

#### Implementation of

`Partial.description`

***

### name

> **name**: `string`

Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:97](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/classes/validators/SectionValidators.ts#L97)

New name of the section (optional).

#### Implementation of

`Partial.name`

***

### nameOrDescription

> **nameOrDescription**: `string`

Defined in: [backend/src/modules/courses/classes/validators/SectionValidators.ts:114](https://github.com/continuousactivelearning/vibe/blob/4a4fd41682dd9274e95c74d5ff310441c462b96e/backend/src/modules/courses/classes/validators/SectionValidators.ts#L114)

At least one of name or description must be provided.
