import {JsonController, Post, HttpCode, Body} from 'routing-controllers';
import {injectable} from 'inversify';

@JsonController('/genai/llm')
@injectable()
export class LLMController {
  constructor() {}

  @Post('/')
  @HttpCode(201)
  async create(@Body() body: any) {
    return {message: 'Not implemented'};
  }
}
