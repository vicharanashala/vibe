import { useContainer } from "routing-controllers";
import { RoutingControllersOptions } from "routing-controllers";
import { ICourseRepository, IDatabase } from "shared/database";
import { CourseRepository } from "shared/database/providers/mongo/repositories/CourseRepository";
import {Container} from "typedi";
import { MongoDatabase } from "shared/database/providers/mongo/MongoDatabase";
import { dbConfig } from "@config/db";
import { CourseController } from "./controllers/CourseController";
import { ICourseService } from "./interfaces/ICourseService";
import { CourseService } from "./services/CourseService";
import { IVersionService } from "./interfaces/IVersionService";
import { VersionService } from "./services/VersionService";
import { VersionController } from "./controllers/VersionController";



useContainer(Container);

if (!Container.has("Database")) {
    Container.set<IDatabase>("Database", new MongoDatabase(dbConfig.url, "vibe"));
}

Container.set<ICourseRepository>("ICourseRepository", new CourseRepository(Container.get<MongoDatabase>("Database")));
Container.set<ICourseService>("ICourseService", new CourseService(Container.get<ICourseRepository>("ICourseRepository")));
Container.set<IVersionService>("IVersionService", new VersionService(Container.get<ICourseRepository>("ICourseRepository")));

export const coursesModuleOptions: RoutingControllersOptions = {
    controllers: [CourseController, VersionController],
    authorizationChecker: async function (action, roles) {
        return true;
    },
};

