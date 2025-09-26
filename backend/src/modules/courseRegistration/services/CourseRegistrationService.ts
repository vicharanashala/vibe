import 'reflect-metadata'
import { GLOBAL_TYPES } from '#root/types.js';
import { inject, injectable } from 'inversify';
import { NotFoundError } from 'routing-controllers';
import { CourseRegistrationRepository } from '../repositories/index.js';
import { plainToInstance } from 'class-transformer';
import { BaseService, MongoDatabase } from '#root/shared/index.js';
import { COURSE_REGISTRATION_TYPES } from '../types.js';

@injectable()

export class CourseRegistrationService extends BaseService{
  constructor(
    @inject(COURSE_REGISTRATION_TYPES.CourseRegistrationRepository)
    private courseRegistrationRepo: CourseRegistrationRepository
    @inject(GLOBAL_TYPES.Database)
    private readonly mongoDatabase: MongoDatabase
  ){
    super(mongoDatabase)
  }

  
} 