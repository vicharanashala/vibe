import { ICourseRegistration, MongoDatabase } from "#root/shared/index.js";
import { inject,injectable } from "inversify";
import {Collection, ClientSession, ObjectId, Filter} from 'mongodb';
import {
  BadRequestError,
  InternalServerError,
  NotFoundError,
} from 'routing-controllers';
import {GLOBAL_TYPES} from '#root/types.js';

class CourseRegistrationRepository{
  private courseRegistrationCollection: Collection<ICourseRegistration>
  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase
  ){}

  private async init(){
    this.courseRegistrationCollection = await this.db.getCollection<ICourseRegistration>('CourseRegistration')
  }
}

export {CourseRegistrationRepository}