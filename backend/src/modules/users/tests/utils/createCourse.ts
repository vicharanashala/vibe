// tests/helpers.ts
import request from 'supertest';
import {faker} from '@faker-js/faker';
import Express from 'express';

interface ItemData {
  name: string;
  description: string;
  type: string;
  videoDetails: {
    URL: string;
    startTime: string;
    endTime: string;
    points: string;
  };
  itemId: string;
}

interface SectionData {
  name: string;
  description: string;
  sectionId: string;
  items: ItemData[];
}

interface ModuleData {
  name: string;
  description: string;
  moduleId: string;
  sections: SectionData[];
}

interface CourseData {
  name: string;
  description: string;
  version: string;
  courseId: string;
  courseVersionId: string;
  modules: ModuleData[];
}

async function createCourseWithModulesSectionsAndItems(
  numberOfModules = 3,
  numberOfSections = 3,
  numberOfItems = 3,
  app: typeof Express,
): Promise<CourseData> {
  const allData: CourseData = {
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    version: '1.0',
    courseId: '',
    courseVersionId: '',
    modules: [],
  };

  // Create Course
  const courseRes = await request(app)
    .post('/courses')
    .send({
      name: allData.name,
      description: allData.description,
    })
    .expect(201);
  allData.courseId = courseRes.body._id;

  // Create Course Version
  const versionRes = await request(app)
    .post(`/courses/${allData.courseId}/versions`)
    .send({version: allData.version, description: 'Initial version'})
    .expect(201);
  allData.courseVersionId = versionRes.body._id;

  // Create Modules, each with Sections, and each Section with Items
  for (let i = 0; i < numberOfModules; i++) {
    const moduleData: ModuleData = {
      name: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      moduleId: '',
      sections: [],
    };

    // Create Module
    const moduleRes = await request(app)
      .post(`/courses/versions/${allData.courseVersionId}/modules`)
      .send({
        name: moduleData.name,
        description: moduleData.description,
      })
      .expect(201);
    moduleData.moduleId = moduleRes.body.version.modules[i].moduleId;

    // Create Sections for the Module
    for (let j = 0; j < numberOfSections; j++) {
      const sectionData: SectionData = {
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        sectionId: '',
        items: [],
      };

      // Create Section
      const sectionRes = await request(app)
        .post(
          `/courses/versions/${allData.courseVersionId}/modules/${moduleData.moduleId}/sections`,
        )
        .send({
          name: sectionData.name,
          description: sectionData.description,
        })
        .expect(201);
      sectionData.sectionId =
        sectionRes.body.version.modules[i].sections[j].sectionId;

      // Create Items for the Section
      for (let k = 0; k < numberOfItems; k++) {
        const itemData: ItemData = {
          name: faker.commerce.productName(),
          description: faker.commerce.productDescription(),
          type: 'VIDEO',
          videoDetails: {
            URL: faker.internet.url(),
            startTime: '00:00:00',
            endTime: '00:00:40',
            points: '10.5',
          },
          itemId: '',
        };

        // Create Item
        const itemRes = await request(app)
          .post(
            `/courses/versions/${allData.courseVersionId}/modules/${moduleData.moduleId}/sections/${sectionData.sectionId}/items`,
          )
          .send(itemData)
          .expect(201);
        //   console.log(itemRes.body);
        //   .expect(201);
        itemData.itemId = itemRes.body.itemsGroup.items[k].itemId;

        sectionData.items.push(itemData);
      }

      moduleData.sections.push(sectionData);
    }

    allData.modules.push(moduleData);
  }

  return allData;
}

export {
  createCourseWithModulesSectionsAndItems,
  CourseData,
  ModuleData,
  SectionData,
  ItemData,
};
