Defined in: [backend/src/modules/courses/controllers/SectionController.ts:41](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/SectionController.ts#L41)

Controller for managing sections within course modules.
Handles creation, update, and reordering of sections under modules in course versions.

## Constructors

### Constructor

> **new SectionController**(`courseRepo`): `SectionController`

Defined in: [backend/src/modules/courses/controllers/SectionController.ts:42](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/SectionController.ts#L42)

#### Parameters

##### courseRepo

`CourseRepository`

#### Returns

`SectionController`

## Methods

### Courses/Controllers

#### create()

> **create**(`params`, `body`): `Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [backend/src/modules/courses/controllers/SectionController.ts:66](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/SectionController.ts#L66)

Create a new section under a specific module within a course version.
Automatically generates and assigns a new ItemsGroup to the section.

##### Parameters

###### params

[`CreateSectionParams`](../Validators/SectionValidators/courses.CreateSectionParams.md)

Route parameters including versionId and moduleId.

###### body

[`CreateSectionBody`](../Validators/SectionValidators/courses.CreateSectionBody.md)

Payload for creating the section (e.g., name, description).

##### Returns

`Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

The updated course version containing the new section.

##### Throws

HTTPError(500) on internal errors.

***

#### move()

> **move**(`params`, `body`): `Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

Defined in: [backend/src/modules/courses/controllers/SectionController.ts:189](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/SectionController.ts#L189)

Reorder a section within its module by calculating a new order key.

##### Parameters

###### params

[`MoveSectionParams`](../Validators/SectionValidators/courses.MoveSectionParams.md)

Route parameters including versionId, moduleId, and sectionId.

###### body

[`MoveSectionBody`](../Validators/SectionValidators/courses.MoveSectionBody.md)

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

Defined in: [backend/src/modules/courses/controllers/SectionController.ts:127](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/courses/controllers/SectionController.ts#L127)

Update an existing section's metadata (name or description).

##### Parameters

###### params

[`UpdateSectionParams`](../Validators/SectionValidators/courses.UpdateSectionParams.md)

Route parameters including versionId, moduleId, and sectionId.

###### body

[`UpdateSectionBody`](../Validators/SectionValidators/courses.UpdateSectionBody.md)

Updated fields for the section.

##### Returns

`Promise`\<\{ `version`: `Record`\<`string`, `any`\>; \}\>

The updated course version with modified section.

##### Throws

HTTPError(500) if the section or module is not found or if update fails.
