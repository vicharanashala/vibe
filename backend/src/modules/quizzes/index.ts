import {useContainer} from 'class-validator';
import {MongoDatabase} from 'shared/database/providers/mongo/MongoDatabase';
import Container from 'typedi';
import {dbConfig} from '../../config/db';
import {RoutingControllersOptions} from 'routing-controllers';
import {QuestionController} from './controllers';

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
