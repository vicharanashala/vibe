import {useContainer} from 'routing-controllers';
import {MongoDatabase} from 'shared/database/providers/mongo/MongoDatabase';
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

// useContainer(Container);

// export function setupQuizzesModuleDependencies(): void {
//       if (!Container.has('Database')) {
//         Container.set('Database', new MongoDatabase(dbConfig.url, 'vibe'));
//       }
// }

export const quizzesModuleOptions: RoutingControllersOptions = {
  controllers: [QuestionController],
  middlewares: [],
  defaultErrorHandler: true,
  authorizationChecker: async function () {
    return true;
  },
  validation: true,
};
