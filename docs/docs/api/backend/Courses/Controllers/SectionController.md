Defined in: [controllers/SectionController.ts:40](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/SectionController.ts#L40)

Controller for managing sections within course modules.
Handles creation, update, and reordering of sections under modules in course versions.

## Constructors

### Constructor

> **new SectionController**(`courseRepo`): `SectionController`

Defined in: [controllers/SectionController.ts:41](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/SectionController.ts#L41)

#### Parameters

##### courseRepo

`CourseRepository`

#### Returns

`SectionController`

## Methods

### Courses/Controllers

#### create()

> **create**(`params`, `body`): `Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [controllers/SectionController.ts:64](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/SectionController.ts#L64)

Create a new section under a specific module within a course version.
Automatically generates and assigns a new ItemsGroup to the section.

##### Parameters

###### params

[`CreateSectionParams`](../Validators/SectionValidators/CreateSectionParams.md)

Route parameters including versionId and moduleId.

###### body

[`CreateSectionBody`](../Validators/SectionValidators/CreateSectionBody.md)

Payload for creating the section (e.g., name, description).

##### Returns

`Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

The updated course version containing the new section.

##### Throws

HTTPError(500) on internal errors.

***

#### move()

> **move**(`params`, `body`): `Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [controllers/SectionController.ts:187](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/SectionController.ts#L187)

Reorder a section within its module by calculating a new order key.

##### Parameters

###### params

[`MoveSectionParams`](../Validators/SectionValidators/MoveSectionParams.md)

Route parameters including versionId, moduleId, and sectionId.

###### body

[`MoveSectionBody`](../Validators/SectionValidators/MoveSectionBody.md)

Positioning details: beforeSectionId or afterSectionId.

##### Returns

`Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

The updated course version with reordered sections.

##### Throws

UpdateError if neither beforeSectionId nor afterSectionId is provided.

##### Throws

HTTPError(500) on internal processing errors.

***

#### update()

> **update**(`params`, `body`): `Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [controllers/SectionController.ts:125](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/controllers/SectionController.ts#L125)

Update an existing section's metadata (name or description).

##### Parameters

###### params

[`UpdateSectionParams`](../Validators/SectionValidators/UpdateSectionParams.md)

Route parameters including versionId, moduleId, and sectionId.

###### body

[`UpdateSectionBody`](../Validators/SectionValidators/UpdateSectionBody.md)

Updated fields for the section.

##### Returns

`Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

The updated course version with modified section.

##### Throws

HTTPError(500) if the section or module is not found or if update fails.
