import {IsBoolean, ValidateIf} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';

class StudyModeBody {
  @JSONSchema({
    title: 'Study mode setting',
    description:
      'true allows study mode here, false disallows it (students must use strict mode), null clears the setting so it inherits from the level above (item → section → module; allowed when nothing is set).',
    type: 'boolean',
    nullable: true,
  })
  @ValidateIf(o => o.studyModeEnabled !== null)
  @IsBoolean()
  studyModeEnabled: boolean | null;
}

class ItemStudyModeResponse {
  @JSONSchema({description: 'ID of the item', type: 'string', readOnly: true})
  itemId: string;

  @JSONSchema({
    description:
      "The item's own study-mode setting after the update (null = inherit)",
    type: 'boolean',
    nullable: true,
    readOnly: true,
  })
  studyModeEnabled: boolean | null;
}

export {StudyModeBody, ItemStudyModeResponse};

export const STUDY_MODE_VALIDATORS = [StudyModeBody, ItemStudyModeResponse];
