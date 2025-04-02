/**
 * @file DTOSignUp.ts
 * @description User signup payload validation class.
 * @module auth
 *
 * @author Aditya BMV
 * @organization DLED
 * @license MIT
 * @created 2025-03-06
 */

import {IsNotEmpty, IsEmail, MinLength, IsAlpha} from 'class-validator';
import {SignUpPayload} from '../interfaces/IAuthService';

export class DTOSignUp implements SignUpPayload {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsAlpha()
  firstName: string;

  @IsAlpha()
  lastName: string;
}
