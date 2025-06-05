import {ContainerModule} from 'inversify';
import TYPES from './types.js';
import {FirebaseAuthService} from './services/index.js';
import {AuthController} from './controllers/index.js';

export const authContainerModule = new ContainerModule(options => {
  // Services
  options.bind(TYPES.AuthService).to(FirebaseAuthService).inSingletonScope();

  // Controllers
  options.bind(AuthController).toSelf().inSingletonScope();
});
