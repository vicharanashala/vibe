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
import { ItemService } from "./services/ItemService";
import { IItemRepository } from "shared/database/interfaces/IItemRepository";
import { ItemRepository } from "shared/database/providers/mongo/repositories/ItemRepository";
import { ItemController } from "./controllers/ItemController";
import { NewCourseRepository } from "shared/database/providers/mongo/repositories/NewCourseRepository";
import { HttpErrorHandler } from "shared/middleware/ErrorHandler";


useContainer(Container);

if (!Container.has("Database")) {
    Container.set<IDatabase>("Database", new MongoDatabase(dbConfig.url, "vibe"));
}

Container.set<ICourseRepository>("ICourseRepository", new CourseRepository(Container.get<MongoDatabase>("Database")));
Container.set<IItemRepository>("IItemRepository", new ItemRepository(Container.get<MongoDatabase>("Database")));
Container.set<ICourseService>("ICourseService", new CourseService(Container.get<ICourseRepository>("ICourseRepository")));
Container.set<IVersionService>("IVersionService", new VersionService(Container.get<ICourseRepository>("ICourseRepository")));
Container.set<ItemService>("ItemService", new ItemService(Container.get<ICourseRepository>("ICourseRepository"), Container.get<IItemRepository>("IItemRepository")));
Container.set("NewCourseRepo", new NewCourseRepository(Container.get<MongoDatabase>("Database")));


export const coursesModuleOptions: RoutingControllersOptions = {
    controllers: [CourseController, ItemController],
    defaultErrorHandler: false,
    middlewares: [HttpErrorHandler],
    authorizationChecker: async function (action, roles) {
        return true;
    },
};

