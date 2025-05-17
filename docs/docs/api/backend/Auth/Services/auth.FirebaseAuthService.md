Defined in: [backend/src/modules/auth/services/FirebaseAuthService.ts:48](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/auth/services/FirebaseAuthService.ts#L48)

Service that implements authentication functionality using Firebase Auth.
Handles user registration, token verification, and password management.

## Implements

## Implements

- [`IAuthService`](../Interfaces/auth.IAuthService.md)

## Constructors

### Constructor

> **new FirebaseAuthService**(`userRepository`): `FirebaseAuthService`

Defined in: [backend/src/modules/auth/services/FirebaseAuthService.ts:60](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/auth/services/FirebaseAuthService.ts#L60)

Creates a new Firebase authentication service instance.
Initializes Firebase Admin SDK with application default credentials.

#### Parameters

##### userRepository

`IUserRepository`

Repository for storing and retrieving user data

#### Returns

`FirebaseAuthService`

## Methods

### changePassword()

> **changePassword**(`body`, `requestUser`): `Promise`\<\{ `message`: `string`; `success`: `boolean`; \}\>

Defined in: [backend/src/modules/auth/services/FirebaseAuthService.ts:150](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/auth/services/FirebaseAuthService.ts#L150)

Changes a user's password in Firebase Auth.
Verifies that passwords match and the user exists before making changes.

#### Parameters

##### body

[`ChangePasswordBody`](../Validators/auth.ChangePasswordBody.md)

Contains the new password and confirmation

##### requestUser

`IUser`

The authenticated user requesting the password change

#### Returns

`Promise`\<\{ `message`: `string`; `success`: `boolean`; \}\>

A promise resolving to a success confirmation object

#### Throws

ChangePasswordError - If passwords don't match or user doesn't exist

#### Implementation of

[`IAuthService`](../Interfaces/auth.IAuthService.md).[`changePassword`](../Interfaces/auth.IAuthService.md#changepassword)

***

### signup()

> **signup**(`body`): `Promise`\<`IUser`\>

Defined in: [backend/src/modules/auth/services/FirebaseAuthService.ts:105](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/auth/services/FirebaseAuthService.ts#L105)

Registers a new user with Firebase Auth and stores user data in the repository.

#### Parameters

##### body

[`SignUpBody`](../Validators/auth.SignUpBody.md)

The validated signup information including email, password, and name

#### Returns

`Promise`\<`IUser`\>

A promise resolving to the newly created user object

#### Throws

Error - If user creation fails in either Firebase or the repository

#### Implementation of

[`IAuthService`](../Interfaces/auth.IAuthService.md).[`signup`](../Interfaces/auth.IAuthService.md#signup)

***

### verifyToken()

> **verifyToken**(`token`): `Promise`\<`IUser`\>

Defined in: [backend/src/modules/auth/services/FirebaseAuthService.ts:76](https://github.com/continuousactivelearning/vibe/blob/2acbe3b478970855555eb5e714d2dc1713e5937b/backend/src/modules/auth/services/FirebaseAuthService.ts#L76)

Verifies a Firebase authentication token and returns the associated user.

#### Parameters

##### token

`string`

The Firebase ID token to verify

#### Returns

`Promise`\<`IUser`\>

A promise that resolves to the user data associated with the token

#### Throws

Error - If the token is invalid or verification fails

#### Implementation of

[`IAuthService`](../Interfaces/auth.IAuthService.md).[`verifyToken`](../Interfaces/auth.IAuthService.md#verifytoken)
