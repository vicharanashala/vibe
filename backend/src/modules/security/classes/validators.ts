import { IsString, IsOptional, IsISO8601 } from 'class-validator';

export class HoneypotTriggerBody {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  currentRoute?: string;

  @IsISO8601()
  timestamp: string;
}

export class HoneypotTriggerResponse {
  status: 'success' | 'error';
  message: string;
}
