// tests/helpers.ts
import request from 'supertest';
import {faker} from '@faker-js/faker';
import Express from 'express';

interface ItemData {
  itemIds: string[];
}

interface SectionData {
  sectionId: string;
  items: ItemData[];
}

interface ModuleData {
  moduleId: string;
  sections: SectionData[];
}

class CourseVersionData {
  versionId: string;
  modules: ModuleData[];
}

export interface Fixture {
  userId: string;
  courseId: string;
  courseVersionId: string;
  moduleId: string;
  sectionId: string;
  itemId: string;
  allData: CourseVersionData;
}

export async function createFullEnrollmentFixture(
  app: typeof Express,
): Promise<Fixture> {
  const allData: any = {
    versionId: '',
    modules: [],
  };

  // Sign Up User
  const signUpBody = {
    email: faker.internet.email(),
    password: faker.internet.password(),
    firstName: faker.person.firstName().replace(/[^a-zA-Z]/g, ''),
    lastName: faker.person.lastName().replace(/[^a-zA-Z]/g, ''),
  };
  const signUpRes = await request(app)
    .post('/auth/signup')
    .send(signUpBody)
    .expect(201);
  const userId = signUpRes.body.id;

  // Create Course
  const courseRes = await request(app)
    .post('/courses')
    .send({
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
    })
    .expect(201);
  const courseId = courseRes.body._id;

  // Create Course Version
  const versionRes = await request(app)
    .post(`/courses/${courseId}/versions`)
    .send({version: '1.0', description: 'Initial version'})
    .expect(201);
  const courseVersionId = versionRes.body.version._id;

  allData.versionId = courseVersionId;
  allData.modules = [];

  // for (let i = 0; i < 3; i++) {
  //   // Create Module
  //   const moduleRes = await request(app)
  //     .post(`/courses/versions/${courseVersionId}/modules`)
  //     .send({
  //       name: faker.commerce.productName(),
  //       description: faker.commerce.productDescription(),
  //     })
  //     .expect(201);

  //   const moduleId = moduleRes.body.version.modules[0].moduleId;
  //   allData.modules.push({
  //     moduleId: moduleId,
  //     sections: [],
  //   });

  //   for (let j = 0; j < 3; j++) {
  //     // Create Section
  //     const sectionRes = await request(app)
  //       .post(`/courses/versions/${courseVersionId}/modules/${moduleId}/sections`)
  //       .send({
  //         name: faker.commerce.productName(),
  //         description: faker.commerce.productDescription(),
  //       })
  //       .expect(201);

  //     const sectionId = sectionRes.body.version.modules[0].sections[0].sectionId;
  //     allData.modules[i].sections.push({
  //       sectionId: sectionId,
  //       items: [],
  //     });

  //     for (let k = 0; k < 3; k++) {
  //       // Create Item
  //       await request(app)
  //         .post(
  //           `/courses/versions/${courseVersionId}/modules/${moduleId}/sections/${sectionId}/items`,
  //         )
  //         .send({
  //           name: faker.commerce.productName(),
  //           description: faker.commerce.productDescription(),
  //           type: 'VIDEO',
  //           videoDetails: {
  //             URL: faker.internet.url(),
  //             startTime: '00:00:00',
  //             endTime: '00:00:40',
  //             points: '10.5',
  //           },
  //         })
  //         .expect(201);

  //     }

  //   }
  // }

  // Create Module 1 Within the Course Version
  const module1Res = await request(app)
    .post(`/courses/versions/${courseVersionId}/modules`)
    .send({
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
    })
    .expect(201);
  const moduleId = module1Res.body.version.modules[0].moduleId;

  // Create Module 2 Within the Course Version
  const module2Res = await request(app)
    .post(`/courses/versions/${courseVersionId}/modules`)
    .send({
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
    })
    .expect(201);

  // 5) section
  const sectionRes = await request(app)
    .post(`/courses/versions/${courseVersionId}/modules/${moduleId}/sections`)
    .send({
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
    })
    .expect(201);
  const sectionId = sectionRes.body.version.modules[0].sections[0].sectionId;

  const section2Res = await request(app)
    .post(`/courses/versions/${courseVersionId}/modules/${moduleId}/sections`)
    .send({
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
    })
    .expect(201);

  // 6) item
  const itemRes = await request(app)
    .post(
      `/courses/versions/${courseVersionId}/modules/${moduleId}/sections/${sectionId}/items`,
    )
    .send({
      name: 'Item1',
      description: 'This an item',
      type: 'VIDEO',
      videoDetails: {
        URL: 'http://url.com',
        startTime: '00:00:00',
        endTime: '00:00:40',
        points: '10.5',
      },
    })
    .expect(201);
  const itemId = itemRes.body.itemsGroup.items[0].itemId;

  const item2Res = await request(app)
    .post(
      `/courses/versions/${courseVersionId}/modules/${moduleId}/sections/${sectionId}/items`,
    )
    .send({
      name: 'Item1',
      description: 'This an item',
      type: 'VIDEO',
      videoDetails: {
        URL: 'http://url.com',
        startTime: '00:00:00',
        endTime: '00:00:40',
        points: '10.5',
      },
    })
    .expect(201);

  // 7) enroll
  await request(app)
    .post(
      `/users/${userId}/enrollments/courses/${courseId}/versions/${courseVersionId}`,
    )
    .expect(200);

  return {
    userId,
    courseId,
    courseVersionId,
    moduleId,
    sectionId,
    itemId,
    allData,
  };
}
