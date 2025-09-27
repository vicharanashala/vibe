import 'reflect-metadata'
import { GLOBAL_TYPES } from '#root/types.js';
import { inject, injectable } from 'inversify';
import { NotFoundError } from 'routing-controllers';
import { CourseRegistrationRepository } from '../repositories/index.js';
import { plainToInstance } from 'class-transformer';
import { BaseService, CourseRepository, EnrollmentRepository, IItemRepository, InviteType, IUserRepository, MongoDatabase } from '#root/shared/index.js';
import { COURSE_REGISTRATION_TYPES } from '../types.js';
import { Invite } from '#root/modules/notifications/index.js';
import { ObjectId } from 'mongodb';
import { CourseDetailsDTO } from '../classes/index.js';
import { USERS_TYPES } from '#root/modules/users/types.js';
import { COURSES_TYPES } from '#root/modules/courses/types.js';

@injectable()

export class CourseRegistrationService extends BaseService{
  constructor(
    @inject(COURSE_REGISTRATION_TYPES.CourseRegistrationRepository)
    private courseRegistrationRepo: CourseRegistrationRepository,
    @inject(USERS_TYPES.EnrollmentRepo)
    private readonly enrollmentRepo: EnrollmentRepository,
    @inject(GLOBAL_TYPES.UserRepo) private readonly userRepo: IUserRepository,
    @inject(COURSES_TYPES.ItemRepo) private readonly itemRepo: IItemRepository,
    @inject(GLOBAL_TYPES.CourseRepo)
    private readonly courseRepo: CourseRepository,
    @inject(GLOBAL_TYPES.Database)
    private readonly mongoDatabase: MongoDatabase
  ){
    super(mongoDatabase)
  }

  async generateLink (courseId:string,versionId:string){
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const invite = new Invite({
          courseId: new ObjectId(courseId),
          courseVersionId: new ObjectId(versionId),
          role:"STUDENT",
          expiresAt,
          type: InviteType.BULK,
        });
  }


  // async getCourseDetails(courseId:string,versionId:string){
  //   const course = await this.courseRepo.read(courseId)
  //   console.log("course ",course)
  //   const version = await this.courseRepo.readVersion(versionId)
  //   console.log("Version ",version)
  //   // return {course,version}
  //   const dto: CourseDetailsDTO = {
  //   courseId: course._id?.toString() ?? '',
  //   versionId: version._id?.toString() ?? '',
  //   version: `${version.version} - ${course.name}`,
  //   description: version.description,
  //   modules: version.modules.map((m) => ({
  //     id: m.moduleId?.toString() ?? '',
  //     name: m.name,
  //     description: m.description,
  //     itemsCount: m.sections.length, // You may need to sum items inside sections if deeper
  //   })),
  //   totalItems: version.totalItems ?? version.modules.reduce((acc, m) => acc + m.sections.length, 0),
  //   createdAt: version.createdAt,
  //   updatedAt: version.updatedAt,
  //   // optional: you can fetch instructors from userRepo if needed
  //   // instructors: await this.userRepo.findInstructors(course.instructors)
  // };
  // return dto
  // }

  async getCourseDetails(versionId:string){
    const courseVersion = await this.courseRepo.readVersion(versionId)
    const course = await this.courseRepo.read(courseVersion.courseId as string)
    const modules = [];
    let totalItems = 0;
  for (const mod of courseVersion.modules || []) {
    // Collect all itemsGroupIds from sections in this module
    const groupIds = mod.sections ? mod.sections.map(section => section.itemsGroupId).filter(id => id) : [];
    
    // Fetch total items for the module
    const itemsCount = await this.itemRepo.getItemsCountByGroupIds(groupIds as string[]);
    console.log("Items count from getCourseDetails ",itemsCount)
    totalItems += itemsCount;

    modules.push({
      id: mod.moduleId, // Use moduleId if available
      name: mod.name,
      description: mod.description,
      itemsCount
    });
  }

  // Fetch instructors
  const instructorIds = await this.enrollmentRepo.getInstructorIdsByVersion(courseVersion.courseId.toString(), versionId);
  const instructorDetails = await this.userRepo.getUserNamesByIds(instructorIds as string[]);
  // Construct the final output (match your sample structure)
  return {
    id: 'v1', // Hardcode or generate dynamically, e.g., based on version string
    courseId: courseVersion.courseId.toString(),
    course:course,
    version: `${courseVersion.version} - ${course.name}`, // Combined as in your example
    description: course.description || courseVersion.description, // Use course desc if version desc is short
    modules,
    totalItems,
    createdAt: courseVersion.createdAt,
    updatedAt: courseVersion.updatedAt,
    instructors: instructorDetails 
  };
  }
} 