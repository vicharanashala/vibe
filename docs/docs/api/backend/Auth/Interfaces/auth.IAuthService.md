Defined in: [backend/src/modules/auth/interfaces/IAuthService.ts:26](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/auth/interfaces/IAuthService.ts#L26)

Interface representing the authentication service.
Defines the contract that any authentication service implementation
must fulfill, regardless of the underlying authentication provider.

## Methods

### changePassword()

> **changePassword**(`body`, `requestUser`): `Promise`\<\{ `message`: `string`; `success`: `boolean`; \}\>

Defined in: [backend/src/modules/auth/interfaces/IAuthService.ts:59](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/auth/interfaces/IAuthService.ts#L59)

Changes the password for an authenticated user.
Validates that the new password meets requirements and updates
the user's credentials in the authentication system.

#### Parameters

##### body

[`ChangePasswordBody`](../Validators/auth.ChangePasswordBody.md)

The payload containing the new password and confirmation

##### requestUser

`IUser`

The authenticated user requesting the password change

#### Returns

`Promise`\<\{ `message`: `string`; `success`: `boolean`; \}\>

A promise that resolves to a confirmation object with success status and message

#### Throws

Error - If password change fails or validation errors occur

***

### signup()

> **signup**(`body`): `Promise`\<`IUser`\>

Defined in: [backend/src/modules/auth/interfaces/IAuthService.ts:37](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/auth/interfaces/IAuthService.ts#L37)

Signs up a new user in the system.
Creates a new user account with the provided credentials and
stores the user information in the database.

#### Parameters

##### body

[`SignUpBody`](../Validators/auth.SignUpBody.md)

The validated payload containing user registration information
              including email, password, first name, and last name

#### Returns

`Promise`\<`IUser`\>

A promise that resolves to the newly created user object

#### Throws

Error - If user creation fails for any reason

***

### verifyToken()

> **verifyToken**(`token`): `Promise`\<`IUser`\>

Defined in: [backend/src/modules/auth/interfaces/IAuthService.ts:47](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/auth/interfaces/IAuthService.ts#L47)

Verifies the validity of an authentication token.
Decodes the token and retrieves the associated user information.

#### Parameters

##### token

`string`

The authentication token to verify (typically a JWT)

#### Returns

`Promise`\<`IUser`\>

A promise that resolves to the user associated with the token

#### Throws

Error - If the token is invalid, expired, or cannot be verified
