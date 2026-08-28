import { IsOptional, IsString } from 'class-validator';

export class JoinDuelDto {
  @IsString()
  @IsOptional()
  inviteToken?: string;
}
