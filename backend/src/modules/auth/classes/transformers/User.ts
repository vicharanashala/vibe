import {
  ObjectIdToString,
  StringToObjectId,
} from '#shared/constants/transformerConstants.js';
import { IUser } from '#shared/interfaces/models.js';
import { Expose, Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';
import { ObjectId } from 'mongodb';

class User implements IUser {
  @Transform(ObjectIdToString.transformer, { toPlainOnly: true }) // Convert ObjectId -> string when serializing
  @Transform(StringToObjectId.transformer, { toClassOnly: true }) // Convert string -> ObjectId when deserializing

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
  lastName?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @JSONSchema({
    title: 'Avatar',
    description: 'Profile image URL or data URI',
  })
  avatar?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @JSONSchema({
    title: 'Gender',
    description: 'Gender',
  })
  gender?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @JSONSchema({
    title: 'Country',
    description: 'Country',
  })
  country?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @JSONSchema({
    title: 'State',
    description: 'State',
  })
  state?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @JSONSchema({
    title: 'City',
    description: 'City',
  })
  city?: string;

  @Expose()
  @JSONSchema({
    title: 'Profile Image',
    description: 'Profile image URL or data URL',
  })
  profileImage?: string;

  @Expose()
  @JSONSchema({
    title: 'Face Embedding',
    description: 'Stored face embedding used for verification',
    type: 'array',
  })
  faceEmbedding?: number[];

  @Expose()
  @IsString()
  @JSONSchema({
    title: 'Roles',
    description: 'Roles',
  })
  roles: 'admin' | 'user';

  constructor(data: Partial<IUser>) {
    this._id = data?._id ? new ObjectId(data?._id) : null;
    this.firebaseUID = data?.firebaseUID;
    this.email = data?.email;
    this.firstName = data?.firstName;
    this.lastName = data?.lastName;
    this.avatar = data?.avatar;
    this.gender = data?.gender;
    this.country = data?.country;
    this.state = data?.state;
    this.city = data?.city;
    this.profileImage = data?.profileImage;
    this.faceEmbedding = data?.faceEmbedding;
    this.roles = data?.roles || 'user';
  }
}

export { User };
