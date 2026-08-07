import { injectable } from 'inversify';
import { validate, ValidationError, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ChatMessageRequest, AdminResponseRequest } from '../types';

@injectable()
export class SupportChatValidator {
  async validateChatMessage(message: ChatMessageRequest): Promise<ValidationError[]> {
    if (!message.question || typeof message.question !== 'string') {
      return [
        {
          property: 'question',
          constraints: { required: 'question is required and must be a string' },
        } as any,
      ];
    }

    if (message.question.trim().length < 3) {
      return [
        {
          property: 'question',
          constraints: { minLength: 'question must be at least 3 characters' },
        } as any,
      ];
    }

    if (message.question.length > 1000) {
      return [
        {
          property: 'question',
          constraints: { maxLength: 'question must not exceed 1000 characters' },
        } as any,
      ];
    }

    return [];
  }

  async validateAdminResponse(response: AdminResponseRequest): Promise<ValidationError[]> {
    if (!response.response || typeof response.response !== 'string') {
      return [
        {
          property: 'response',
          constraints: { required: 'response is required and must be a string' },
        } as any,
      ];
    }

    if (response.response.trim().length < 10) {
      return [
        {
          property: 'response',
          constraints: { minLength: 'response must be at least 10 characters' },
        } as any,
      ];
    }

    if (response.response.length > 5000) {
      return [
        {
          property: 'response',
          constraints: { maxLength: 'response must not exceed 5000 characters' },
        } as any,
      ];
    }

    return [];
  }
}
