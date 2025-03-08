import { useContainer } from "class-validator";
import { RoutingControllersOptions } from "routing-controllers";
import { ICourseRepository, IDatabase } from "shared/database";
import { CourseRepository } from "shared/database/providers/mongo/repositories/CourseRepository";
import {Container} from "typedi";
import { MongoDatabase } from "shared/database/providers/mongo/MongoDatabase";
import { dbConfig } from "@config/db";
import { CourseController } from "./CourseController";
import { ICourseService } from "./ICourseService";
import { CourseService } from "./CourseService";



useContainer(Container);

if (!Container.has("Database")) {
    Container.set<IDatabase>("Database", new MongoDatabase(dbConfig.url, "vibe"));
}

Container.set<ICourseRepository>("ICourseRepository", new CourseRepository(Container.get<MongoDatabase>("Database")));
Container.set<ICourseService>("ICourseService", new CourseService(Container.get<ICourseRepository>("ICourseRepository")));


export const coursesModuleOptions: RoutingControllersOptions = {
    controllers: [CourseController],
    authorizationChecker: async function (action, roles) {
        return true;
    },
};

