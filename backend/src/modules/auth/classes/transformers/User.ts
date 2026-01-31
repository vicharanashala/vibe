import {
  ObjectIdToString,
  StringToObjectId,
} from '#shared/constants/transformerConstants.js';
import {IUser} from '#shared/interfaces/models.js';
import {Expose, Transform} from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import {ObjectId} from 'mongodb';
import { title } from 'process';

class User implements IUser {
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true}) // Convert ObjectId -> string when serializing
  @Transform(StringToObjectId.transformer, {toClassOnly: true}) // Convert string -> ObjectId when deserializing

  @Expose()
  @JSONSchema({
    title: 'User ID',
    description: 'User ID',
  })
  _id: string | ObjectId | null;


  @IsString()
  @Expose()
  @JSONSchema({
    title: 'Firebase UID',
    description: 'Firebase UID',
  })
  firebaseUID: string;

  @Expose()
  @IsString()
  @JSONSchema({
    title: 'Email',
    description: 'Email',
  })
  email: string;

  @Expose()
  @IsString()
  @JSONSchema({
    title: 'First Name',
    description: 'First Name',
  })
  firstName: string;

  @Expose()
  @IsString()
  @JSONSchema({
    title: 'Last Name',
    description: 'Last Name',
  })
  lastName: string;

  @Expose()
  @IsString()
  @JSONSchema({
    title: 'Roles',
    description: 'Roles',
  })
  roles: 'admin' | 'user';

  @Expose()
  @IsString()
  @JSONSchema({
    title:"Avatar",
    description:"User's avatar URL",
  })
  avatar?:string;

  constructor(data: Partial<IUser>) {
    this._id = data?._id ? new ObjectId(data?._id) : null;
    this.firebaseUID = data?.firebaseUID;
    this.email = data?.email;
    this.firstName = data?.firstName;
    this.lastName = data?.lastName;
    this.roles = data?.roles || 'user';
    this.avatar = data?.avatar;
  }
}

export {User};
