import {useContainer} from 'routing-controllers';
import {dbConfig} from '../../config/db';
import {RoutingControllersOptions} from 'routing-controllers';
import {QuestionController} from './controllers';
import {InversifyAdapter} from '../../inversify-adapter';
import {Container} from 'inversify';
import {sharedContainerModule} from '../../container';
import {quizzesContainerModule} from './container';

export async function setupQuizzesContainer(): Promise<void> {
  const container = new Container();
  await container.load(sharedContainerModule, quizzesContainerModule);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}

export const quizzesModuleOptions: RoutingControllersOptions = {
  controllers: [QuestionController],
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};
