import {IUserAnomaly, ProctoringComponent} from '#root/shared/index.js';
import {IsMongoId, IsString, IsNotEmpty, IsEnum} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';

export class CreateAnamolyBody implements Partial<IUserAnomaly> {
  @JSONSchema({
    description: 'User ID of the student',
    example: '60d5ec49b3f1c8e4a8f8b8c1',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  userId: string;

  @JSONSchema({
    description: 'ID of the course',
    example: '60d5ec49b3f1c8e4a8f8b8c2',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  courseId: string;

  @JSONSchema({
    description: 'ID of the specific course version',
    example: '60d5ec49b3f1c8e4a8f8b8c3',
    type: 'string',
    format: 'Mongo Object ID',
  })
  @IsMongoId()
  @IsString()
  @IsNotEmpty()
  courseVersionId: string;

  @JSONSchema({
    description: 'Type of anomaly detected',
    example: 'low_progress',
    type: 'string',
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(ProctoringComponent)
  anomalyType: ProctoringComponent;

  // Optional fields for module, section, and item IDs
  moduleId?: string;
  sectionId?: string;
  itemId?: string;
}
