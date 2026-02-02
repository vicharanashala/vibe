import { Expose } from 'class-transformer';
import { IsString } from 'class-validator';

class ProgressModuleDto {
  @Expose()
  @IsString()
  id: string;

  @Expose()
  @IsString()
  name: string;
}

class ProgressSectionDto {
  @Expose()
  @IsString()
  id: string;

  @Expose()
  @IsString()
  name: string;
}

class ProgressItemDto {
  @Expose()
  @IsString()
  id: string;

  @Expose()
  @IsString()
  name: string;

  @Expose()
  @IsString()
  type: string;
}

export class GetCurrentProgressPathResponse {
  @Expose()
  module: ProgressModuleDto;

  @Expose()
  section: ProgressSectionDto;

  @Expose()
  item: ProgressItemDto;
}
