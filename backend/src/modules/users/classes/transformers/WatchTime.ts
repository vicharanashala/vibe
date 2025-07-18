import { ID, IWatchTime, ObjectIdToString, StringToObjectId } from "#root/shared/index.js";
import { Expose, Transform } from "class-transformer"; 

@Expose()
export class WatchTime implements IWatchTime {
    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    _id?: ID;

    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    userId: ID;

    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    courseId: ID;

    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    courseVersionId: ID;

    @Expose()
    @Transform(ObjectIdToString.transformer, { toPlainOnly: true })
    @Transform(StringToObjectId.transformer, { toClassOnly: true })
    itemId: ID;

    @Expose()
    startTime: Date;

    @Expose()
    endTime?: Date;

    constructor(
        userId: string,
        courseId: string,
        courseVersionId: string,
        itemId: string,
        startTime: Date,
        endTime?: Date
    ) {
        if (
            userId &&
            courseId &&
            courseVersionId &&
            itemId &&
            startTime &&
            endTime
        ) {
            this.userId = userId;
            this.courseId = courseId;
            this.courseVersionId = courseVersionId;
            this.itemId = itemId;
            this.startTime = startTime;
            this.endTime = endTime;
        }
    }
}