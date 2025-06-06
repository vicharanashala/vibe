import {sharedContainerModule} from '#root/container.js';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import {Container} from 'inversify';
import {
  RoutingControllersOptions,
  Action,
  useContainer,
  getFromContainer,
} from 'routing-controllers';
import {authContainerModule} from './container.js';
import {AuthController} from './controllers/AuthController.js';
import {FirebaseAuthService} from './services/FirebaseAuthService.js';

export async function setupAuthContainer(): Promise<void> {
  const container = new Container();
  await container.load(sharedContainerModule, authContainerModule);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const authModuleOptions: RoutingControllersOptions = {
  controllers: [AuthController],
  authorizationChecker: async function (action: Action, roles: string[]) {
    // Use the auth service to check if the user is authorized
    const authService =
      getFromContainer<FirebaseAuthService>(FirebaseAuthService);
    const token = action.request.headers['authorization']?.split(' ')[1];
    if (!token) {
      return false;
    }

    try {
      const user = await authService.verifyToken(token);
      action.request.user = user;

      // Check if the user's roles match the required roles
      if (roles.length > 0 && !roles.some(role => user.roles.includes(role))) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  },
  currentUserChecker: async (action: Action) => {
    // Use the auth service to get the current user
    const authService =
      getFromContainer<FirebaseAuthService>(FirebaseAuthService);
    const token = action.request.headers['authorization']?.split(' ')[1];
    if (!token) {
      return null;
    }
    try {
      return await authService.verifyToken(token);
    } catch (error) {
      return null;
    }
  },
};

export * from './classes/index.js';
export * from './controllers/index.js';
export * from './interfaces/index.js';
export * from './services/index.js';
export * from './container.js';
export * from './types.js';
