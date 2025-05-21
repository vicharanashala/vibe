import Express from 'express';
import {setupAuthModuleDependencies, authModuleOptions} from 'modules/auth';
import {
  setupCoursesModuleDependencies,
  coursesModuleOptions,
} from 'modules/courses';
import {setupUsersModuleDependencies, usersModuleOptions} from 'modules/users';
import {ProgressService} from 'modules/users/services/ProgressService';
import {
  CourseData,
  createCourseWithModulesSectionsAndItems,
} from 'modules/users/tests/utils/createCourse';
import {createEnrollment} from 'modules/users/tests/utils/createEnrollment';
import {createUser} from 'modules/users/tests/utils/createUser';
import {RoutingControllersOptions, useExpressServer} from 'routing-controllers';
import {CourseRepository} from 'shared/database/providers/mongo/repositories/CourseRepository';
import {ProgressRepository} from 'shared/database/providers/mongo/repositories/ProgressRepository';
import {
  MongoDatabase,
  UserRepository,
} from 'shared/database/providers/MongoDatabaseProvider';
import {IUser} from 'shared/interfaces/Models';
import Container from 'typedi';
import {quizzesModuleOptions} from '..';
import {IQuestion, ISOLSolution} from 'shared/interfaces/quiz';
import {SOLQuestion} from '../classes/transformers';
import {CreateQuestionBody, SOLSolution} from '../classes/validators';
import {dbConfig} from '../../../config/db';
import request from 'supertest';

describe('Progress Controller Integration Tests', () => {
  const appInstance = Express();
  let app;
  let user: IUser;
  let courseData: CourseData;

  beforeAll(async () => {
    //Set env variables
    process.env.NODE_ENV = 'test';
    // setupQuizzesModuleDependencies();

    // Create the Express app with routing-controllers configuration
    const options: RoutingControllersOptions = {
      controllers: [...(quizzesModuleOptions.controllers as Function[])],
      authorizationChecker: async (action, roles) => {
        return true;
      },
      defaultErrorHandler: true,
      validation: true,
    };

    app = useExpressServer(appInstance, options);
  }, 900000);

  afterAll(async () => {
    Container.reset();
  });

  beforeEach(async () => {}, 10000);

  describe('Create Question', () => {
    it('should create a question', async () => {
      const questionData: IQuestion = {
        text: 'NumExprTex: <NumExprTex>a^b</NumExprTex>, NumExpr: <NumExpr>(a^b)</NumExpr>, NumExpr: <NumExpr>a</NumExpr>, QParam: <QParam>name</QParam>, QParam: <QParam>name2</QParam>',
        type: 'SELECT_ONE_IN_LOT',
        points: 10,
        timeLimitSeconds: 60,
        isParameterized: true,
        parameters: [
          {
            name: 'a',
            possibleValues: ['20', '10'],
            type: 'number',
          },
          {
            name: 'b',
            possibleValues: ['1', '2', '3', '4.5', '7'],
            type: 'string',
          },
          {
            name: 'name',
            possibleValues: ['John', 'Doe'],
            type: 'string',
          },
          {
            name: 'name2',
            possibleValues: ['Kalix', 'Danny'],
            type: 'string',
          },
        ],
        hint: 'This is a hint',
      };

      const solution: ISOLSolution = {
        correctLotItem: {
          text: 'This is the correct answer <QParam>name</QParam>',
          explaination:
            'This is the explanation for the correct answer <QParam>name</QParam>',
        },
        incorrectLotItems: [
          {
            text: 'This is an incorrect answer',
            explaination: 'This is the explanation for the incorrect answer',
          },
          {
            text: 'This is another incorrect answer',
            explaination:
              'This is the explanation for another incorrect answer',
          },
        ],
      };

      const body: CreateQuestionBody = {
        question: questionData,
        solution: solution,
      };

      const response = await request(app).post('/questions').send(body);

      expect(response.status).toBe(201);
    });
  });
});
