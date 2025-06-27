import request from 'supertest';
import {faker} from '@faker-js/faker';
import Express from 'express';

export async function createUser(app: typeof Express): Promise<string> {
  // Prepare user sign-up data using Faker
  const signUpBody = {
    email: faker.internet.email(),
    password: faker.internet.password(),
    firstName: faker.person.firstName().replace(/[^a-zA-Z]/g, ''),
    lastName: faker.person.lastName().replace(/[^a-zA-Z]/g, ''),
  };

  // Send POST request to sign up the user
  const signUpRes = await request(app)
    .post('/auth/signup')
    .send(signUpBody)
    .expect(201); // Expecting a 201 created status

  // Return the user object
  return signUpRes.body.userId; // Assuming the response body contains the user object
}
