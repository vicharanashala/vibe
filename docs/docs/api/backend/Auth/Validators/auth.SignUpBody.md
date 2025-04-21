Defined in: [backend/src/modules/auth/classes/validators/AuthValidators.ts:25](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/auth/classes/validators/AuthValidators.ts#L25)

Data Transfer Object (DTO) for user registration.
Validates that the required fields meet the criteria for creating a new account.

## Constructors

### Constructor

> **new SignUpBody**(): `SignUpBody`

#### Returns

`SignUpBody`

## Properties

### email

> **email**: `string`

Defined in: [backend/src/modules/auth/classes/validators/AuthValidators.ts:32](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/auth/classes/validators/AuthValidators.ts#L32)

The email address of the new user.
Must be a valid email format as defined by the IsEmail validator.
Used as the primary login identifier and for account recovery.

***

### firstName

> **firstName**: `string`

Defined in: [backend/src/modules/auth/classes/validators/AuthValidators.ts:49](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/auth/classes/validators/AuthValidators.ts#L49)

The first name of the user.
Must contain only alphabetic characters (no numbers or special characters).
Used for personalization and display purposes.

***

### lastName

> **lastName**: `string`

Defined in: [backend/src/modules/auth/classes/validators/AuthValidators.ts:57](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/auth/classes/validators/AuthValidators.ts#L57)

The last name of the user.
Must contain only alphabetic characters (no numbers or special characters).
Used for personalization and display purposes.

***

### password

> **password**: `string`

Defined in: [backend/src/modules/auth/classes/validators/AuthValidators.ts:41](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/auth/classes/validators/AuthValidators.ts#L41)

The password for the new account.
Must be at least 8 characters long.
Used for authenticating the user on subsequent logins.
