Defined in: [classes/validators/ItemValidators.ts:70](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L70)

Quiz item details for scheduled quiz-based evaluation.

## Implements

- `IQuizDetails`

## Constructors

### Constructor

> **new QuizDetailsPayloadValidator**(): `QuizDetailsPayloadValidator`

#### Returns

`QuizDetailsPayloadValidator`

## Properties

### deadline

> **deadline**: `Date`

Defined in: [classes/validators/ItemValidators.ts:96](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L96)

ISO date string for quiz deadline.

#### Implementation of

`IQuizDetails.deadline`

***

### questions

> **questions**: `string`[]

Defined in: [classes/validators/ItemValidators.ts:89](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L89)

List of quiz question IDs (auto-managed).

#### Implementation of

`IQuizDetails.questions`

***

### questionVisibility

> **questionVisibility**: `number`

Defined in: [classes/validators/ItemValidators.ts:76](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L76)

Number of quiz questions visible to students.

#### Implementation of

`IQuizDetails.questionVisibility`

***

### releaseTime

> **releaseTime**: `Date`

Defined in: [classes/validators/ItemValidators.ts:83](https://github.com/continuousactivelearning/vibe/blob/dbf557f2b5c1ec47c296f0289b3a6f789bb5efa2/backend/src/modules/courses/classes/validators/ItemValidators.ts#L83)

ISO date string representing quiz release time.

#### Implementation of

`IQuizDetails.releaseTime`
