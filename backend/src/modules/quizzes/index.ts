import {useContainer} from 'class-validator';
import {dbConfig} from '../../config/db.js';
import {RoutingControllersOptions} from 'routing-controllers';
import {QuestionController} from './controllers/index.js';
import {InversifyAdapter} from '../../inversify-adapter.js';
import {Container} from 'inversify';
import {sharedContainerModule} from '../../container.js';
import {quizzesContainerModule} from './container.js';

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
