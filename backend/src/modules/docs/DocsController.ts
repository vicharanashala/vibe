import {apiReference} from '@scalar/express-api-reference';
import {Controller, Get} from 'routing-controllers';
import {OpenApiSpecService} from './services/OpenApiSpecService.js';

@Controller('/docs')
class DocsController {
  @Get('/')
  async getDocs() {
    const openApiSpecService = new OpenApiSpecService();
    const openApiSpec = openApiSpecService.generateOpenAPISpec();

    return apiReference({
      content: openApiSpec,
      theme: 'deepSpace',
    });
  }
}

export {DocsController};
