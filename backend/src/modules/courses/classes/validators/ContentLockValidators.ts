import {IsBoolean, ValidateIf} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';

class ContentLockBody {
  @JSONSchema({
    title: 'Lock setting',
    description:
      'true locks this for students, false keeps it open inside something locked, null clears the setting so it inherits.',
    type: 'boolean',
    nullable: true,
  })
  @ValidateIf(o => o.isLocked !== null)
  @IsBoolean()
  isLocked: boolean | null;
}

class ItemContentLockResponse {
  @JSONSchema({description: 'ID of the item', type: 'string', readOnly: true})
  itemId: string;

  @JSONSchema({
    description:
      "The item's own lock setting after the update (null = inherit)",
    type: 'boolean',
    nullable: true,
    readOnly: true,
  })
  isLocked: boolean | null;
}

export {ContentLockBody, ItemContentLockResponse};

export const CONTENT_LOCK_VALIDATORS = [
  ContentLockBody,
  ItemContentLockResponse,
];
