import {IsString, IsNotEmpty} from 'class-validator';

export class AddFaceRequest {
  @IsNotEmpty()
  @IsString()
  imageData!: string;

  @IsNotEmpty()
  @IsString()
  personName!: string;
}

export class KnownFacesResponse {
  faces!: Array<{
    label: string;
    imagePaths: string[];
  }>;
}

export class UploadFaceResponse {
  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsString()
  @IsNotEmpty()
  path!: string;
}

export class AddPersonResponse {
  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsString()
  @IsNotEmpty()
  path!: string;
}
