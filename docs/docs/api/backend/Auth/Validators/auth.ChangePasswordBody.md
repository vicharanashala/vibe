Defined in: [backend/src/modules/auth/classes/validators/AuthValidators.ts:67](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/auth/classes/validators/AuthValidators.ts#L67)

Data Transfer Object (DTO) for password change requests.
Validates that the new password meets security requirements
and that the confirmation matches.

## Constructors

### Constructor

> **new ChangePasswordBody**(): `ChangePasswordBody`

#### Returns

`ChangePasswordBody`

## Properties

### newPassword

> **newPassword**: `string`

Defined in: [backend/src/modules/auth/classes/validators/AuthValidators.ts:84](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/auth/classes/validators/AuthValidators.ts#L84)

The new password to set for the user account.
Must meet strong password requirements:
- At least 8 characters long
- Contains at least one uppercase letter
- Contains at least one lowercase letter
- Contains at least one number
- Contains at least one special character

***

### newPasswordConfirm

> **newPasswordConfirm**: `string`

Defined in: [backend/src/modules/auth/classes/validators/AuthValidators.ts:99](https://github.com/continuousactivelearning/vibe/blob/9a2d9d7201b944582c5d0ed5f0f7a4de13abde0f/backend/src/modules/auth/classes/validators/AuthValidators.ts#L99)

Confirmation of the new password.
Must exactly match the newPassword field to ensure the user
hasn't made a typing error.
This field is compared against newPassword during validation in the service layer.
