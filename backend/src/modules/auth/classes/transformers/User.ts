import {
  ObjectIdToString,
  StringToObjectId,
} from '#shared/constants/transformerConstants.js';
import {IUser} from '#shared/interfaces/models.js';
import {Expose, Transform} from 'class-transformer';
import {ObjectId} from 'mongodb';

class User implements IUser {
  @Transform(ObjectIdToString.transformer, {toPlainOnly: true}) // Convert ObjectId -> string when serializing
  @Transform(StringToObjectId.transformer, {toClassOnly: true}) // Convert string -> ObjectId when deserializing
  @Expose()
  _id: string | ObjectId | null;

  @Expose()
  firebaseUID: string;

  @Expose()
  email: string;

  @Expose()
  firstName: string;

  @Expose()
  lastName: string;

  @Expose()
  roles: string[];

  constructor(data: Partial<IUser>) {
    this._id = data._id ? new ObjectId(data._id) : null;
    this.firebaseUID = data.firebaseUID;
    this.email = data.email;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.roles = data.roles || [];
  }
}

export {User};
