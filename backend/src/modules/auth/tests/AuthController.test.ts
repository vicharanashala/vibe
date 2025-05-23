import {MongoMemoryServer} from 'mongodb-memory-server';
import request from 'supertest';
import Express from 'express';
import {useExpressServer} from 'routing-controllers';
import {Container} from 'typedi';

// TODO: Update the import paths below to your project's structure
import {MongoDatabase} from '../../../shared/database/providers/mongo/MongoDatabase';
import {authModuleOptions, SignUpBody} from '../index';
import {UserRepository} from 'shared/database/providers/MongoDatabaseProvider';
import {faker} from '@faker-js/faker';

describe('Auth Controller Integration Tests', () => {
  const appInstance = Express();
  let app;
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    // Start an in-memory MongoDB servera
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    // Set up the real MongoDatabase and Repository
    Container.set('Database', new MongoDatabase(uri, 'vibe'));
    const repo = new UserRepository(Container.get<MongoDatabase>('Database'));
    Container.set('Repo', repo);

    // Create the Express app with routing-controllers configuration
    app = useExpressServer(appInstance, authModuleOptions);
  });

  afterAll(async () => {
    // Stop the in-memory MongoDB server
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // TODO: Optionally reset database state before each test
  });

  // ------Tests for Create <ModuleName>------
  describe('Sign Up Test', () => {
    it('should sign up a new user successfully', async () => {
      const signUpBody: SignUpBody = {
        email: faker.internet.email(),
        password: faker.internet.password(),
        firstName: faker.person.firstName('male').replace(/[^a-zA-Z]/g, ''),
        lastName: faker.person.lastName().replace(/[^a-zA-Z]/g, ''),
      };
      const response = await request(app).post('/auth/signup').send(signUpBody);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(signUpBody.email);
      expect(response.body.firstName).toBe(signUpBody.firstName);
      expect(response.body.lastName).toBe(signUpBody.lastName);
      expect(response.body).not.toHaveProperty('password');
    });
    it('should return 400 for invalid email', async () => {
      const signUpBody: SignUpBody = {
        email: 'invalid-email',
        password: faker.internet.password(),
        firstName: faker.person.firstName().replace(/[^a-zA-Z]/g, ''),
        lastName: faker.person.lastName().replace(/[^a-zA-Z]/g, ''),
      };
      const response = await request(app).post('/auth/signup').send(signUpBody);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors[0].constraints.isEmail).toBeDefined();
      expect(response.body.errors[0].constraints.isEmail).toBe(
        'email must be an email',
      );
    });
    it('should return 400 for missing required fields', async () => {
      const signUpBody: SignUpBody = {
        email: '',
        password: '',
        firstName: '',
        lastName: '',
      };
      const response = await request(app).post('/auth/signup').send(signUpBody);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
    it('should return 400 for weak password', async () => {
      const signUpBody: SignUpBody = {
        email: faker.internet.email(),
        password: '123',
        firstName: faker.person.firstName().replace(/[^a-zA-Z]/g, ''),
        lastName: faker.person.lastName().replace(/[^a-zA-Z]/g, ''),
      };
      const response = await request(app).post('/auth/signup').send(signUpBody);
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('errors');
    });
  });
});
