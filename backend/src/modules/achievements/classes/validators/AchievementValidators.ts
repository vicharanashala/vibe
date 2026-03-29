import {IsMongoId, IsNotEmpty} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';

export class UserIdParams {
  @JSONSchema({description: 'MongoDB user ID', type: 'string'})
  @IsMongoId()
  @IsNotEmpty()
  userId: string;
}
