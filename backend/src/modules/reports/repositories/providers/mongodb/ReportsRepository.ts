import { IReport, IStatus } from '#shared/interfaces/index.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { injectable, inject } from 'inversify';
import { Collection, ClientSession, ObjectId } from 'mongodb';
import { InternalServerError } from 'routing-controllers';
import { GLOBAL_TYPES } from '#root/types.js';
@injectable()
class ReportRepository {
    private reportCollection: Collection<IReport>;
    constructor(
        @inject(GLOBAL_TYPES.Database)
        private db: MongoDatabase,
    ) { }

    private async init() {
        this.reportCollection =
            await this.db.getCollection<IReport>('reports');
    }

    public async create(report: IReport, session?: ClientSession) {
        await this.init();
        const result = await this.reportCollection.insertOne(report, { session });
        if (result.acknowledged && result.insertedId) {
            return result.insertedId.toString();
        }
        throw new InternalServerError('Failed to create quiz attempt');
    }

    public async update(reportId: string, updateData: IStatus) {
        await this.init();
        const result = await this.reportCollection.findOneAndUpdate(
            { _id: new ObjectId(reportId) },
            {
                $push: { status: updateData },
                $set: { updatedAt: new Date() },
            },
            { returnDocument: 'after' },
        );
        return result;
    }

}

export { ReportRepository };
