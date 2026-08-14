import {
  IsBoolean,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {JSONSchema} from 'class-validator-jsonschema';
import {Transform, Type} from 'class-transformer';
import {VideoAssetStatus} from '../transformers/VideoAsset.js';

export class CreateVideoUploadUrlBody {
  @JSONSchema({
    title: 'Course ID',
    description: 'Course the uploaded video belongs to',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  courseId: string;

  @JSONSchema({
    title: 'Course Version ID',
    description: 'Course version the uploaded video belongs to',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  courseVersionId: string;

  @JSONSchema({
    title: 'File Name',
    description: 'Original filename, used to derive the stored extension',
    example: 'lecture-01.mp4',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  fileName: string;

  @JSONSchema({
    title: 'Content Type',
    description:
      'MIME type of the upload. Pinned into the signed URL — the PUT must send this exact Content-Type header.',
    example: 'video/mp4',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  contentType: string;

  @JSONSchema({
    title: 'Size in Bytes',
    description:
      'File size, checked against the configured maximum. Required, not optional: ' +
      'the size limit is enforced from this value, so allowing it to be omitted ' +
      'would let a caller skip the check entirely.',
    example: 524288000,
    type: 'number',
  })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes: number;

  @JSONSchema({
    title: 'Title',
    description:
      'Library display name. Defaults to the filename without its extension.',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @JSONSchema({title: 'Description', type: 'string'})
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateVideoAssetBody {
  @JSONSchema({title: 'Title', type: 'string'})
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @JSONSchema({title: 'Description', type: 'string'})
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @JSONSchema({
    title: 'Duration in Seconds',
    description:
      'Reported by the client once the video loads. Used only to prefill and ' +
      'validate segment timestamps.',
    type: 'number',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationSeconds?: number;
}

export class VideoAssetIdParams {
  @JSONSchema({
    title: 'Video Asset ID',
    type: 'string',
  })
  @IsNotEmpty()
  @IsMongoId()
  assetId: string;
}

export class ListVideoAssetsQuery {
  @IsNotEmpty()
  @IsMongoId()
  courseId: string;

  @IsNotEmpty()
  @IsMongoId()
  courseVersionId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @JSONSchema({
    title: 'Search',
    description: 'Case-insensitive match on title or original filename',
    type: 'string',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @JSONSchema({
    title: 'Ready Only',
    description:
      'Restrict to playable videos — used by the item editor, since a video ' +
      'still processing cannot be segmented yet.',
    type: 'boolean',
  })
  @IsOptional()
  @Transform(({value}) => value === true || value === 'true')
  @IsBoolean()
  readyOnly?: boolean;
}

export class CreateVideoUploadUrlResponse {
  @JSONSchema({type: 'string'})
  assetId: string;

  @JSONSchema({
    description: 'Signed URL to PUT the file to. Never proxied through ViBe.',
    type: 'string',
  })
  uploadUrl: string;

  @JSONSchema({type: 'string'})
  uploadObjectKey: string;

  @JSONSchema({
    description: 'When the upload URL stops working',
    type: 'string',
  })
  expiresAt: Date;

  @JSONSchema({
    description: 'Content-Type header the PUT must send, byte for byte',
    type: 'string',
  })
  requiredContentType: string;
}

export class VideoAssetResponse {
  @JSONSchema({type: 'string'})
  assetId: string;

  @JSONSchema({type: 'string'})
  status: VideoAssetStatus;

  @JSONSchema({description: 'Library display name', type: 'string'})
  title: string;

  @JSONSchema({type: 'string'})
  description?: string;

  @JSONSchema({type: 'string'})
  originalFileName: string;

  @JSONSchema({
    description: 'True when a playback grant can be issued',
    type: 'boolean',
  })
  playable: boolean;

  @JSONSchema({type: 'number'})
  sizeBytes?: number;

  @JSONSchema({type: 'number'})
  durationSeconds?: number;

  @JSONSchema({type: 'string'})
  failureReason?: string;

  @JSONSchema({type: 'string'})
  createdAt: Date;
}

export class VideoAssetListResponse {
  items: VideoAssetResponse[];
}

export class VideoPlaybackGrantResponse {
  @JSONSchema({
    description: 'HLS master playlist URL for the player to load',
    type: 'string',
  })
  url: string;

  @JSONSchema({
    description:
      'When the grant expires. Clients should re-request before this to avoid a mid-lesson stall.',
    type: 'string',
  })
  expiresAt: Date;
}
