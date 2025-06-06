import {ContainerModule} from 'inversify';
import TYPES from './types';
import {FirebaseAuthService} from './services';
import {AuthController} from './controllers';

export const authContainerModule = new ContainerModule(options => {
  // Services
  options.bind(TYPES.AuthService).to(FirebaseAuthService).inSingletonScope();

  // Controllers
  options.bind(AuthController).toSelf().inSingletonScope();
});
