/**
 * @file AuthValidators.ts
 * @description Validation classes for authentication-related payloads.
 *
 * @category Auth/Validators
 * @categoryDescription
 * Validation classes for authentication-related payloads.
 * Includes DTOs for user signup and password change.
 */

import {
  IsAlpha,
  IsEmail,
  IsNotEmpty,
  Matches,
  MinLength,
} from 'class-validator';

/**
 * Data Transfer Object (DTO) for user registration.
 * Validates that the required fields meet the criteria for creating a new account.
 *
 * @category Auth/Validators
 */
class SignUpBody {
  /**
   * The email address of the new user.
   * Must be a valid email format as defined by the IsEmail validator.
   * Used as the primary login identifier and for account recovery.
   */
  @IsEmail()
  email: string;

  /**
   * The password for the new account.
   * Must be at least 8 characters long.
   * Used for authenticating the user on subsequent logins.
   */
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  /**
   * The first name of the user.
   * Must contain only alphabetic characters (no numbers or special characters).
   * Used for personalization and display purposes.
   */
  @IsAlpha()
  firstName: string;

  /**
   * The last name of the user.
   * Must contain only alphabetic characters (no numbers or special characters).
   * Used for personalization and display purposes.
   */
  @IsAlpha()
  lastName: string;
}

/**
 * Data Transfer Object (DTO) for password change requests.
 * Validates that the new password meets security requirements
 * and that the confirmation matches.
 *
 * @category Auth/Validators
 */
class ChangePasswordBody {
  /**
   * The new password to set for the user account.
   * Must meet strong password requirements:
   * - At least 8 characters long
   * - Contains at least one uppercase letter
   * - Contains at least one lowercase letter
   * - Contains at least one number
   * - Contains at least one special character
   */
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'Password must be at least 8 characters long, include at least one uppercase letter, one lowercase letter, one number, and one special character.',
    },
  )
  newPassword: string;

  /**
   * Confirmation of the new password.
   * Must exactly match the newPassword field to ensure the user
   * hasn't made a typing error.
   * This field is compared against newPassword during validation in the service layer.
   */
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'Password must be at least 8 characters long, include at least one uppercase letter, one lowercase letter, one number, and one special character.',
    },
  )
  newPasswordConfirm: string;
}

export {SignUpBody, ChangePasswordBody};
