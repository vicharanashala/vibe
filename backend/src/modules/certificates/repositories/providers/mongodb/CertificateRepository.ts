import {MongoDatabase} from '#shared/database/providers/mongo/MongoDatabase.js';
import {injectable, inject} from 'inversify';
import {Collection, ObjectId} from 'mongodb';
import {GLOBAL_TYPES} from '#root/types.js';
import {ICertificate} from '#root/modules/certificates/models.js';
import {CERTIFICATES_COLLECTION} from '#root/modules/certificates/constants.js';

@injectable()
class CertificateRepository {
  private certificateCollection: Collection<ICertificate>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.certificateCollection = await this.db.getCollection<ICertificate>(
      CERTIFICATES_COLLECTION,
    );
  }

  /**
   * One certificate per (user, course, version) — this is what makes
   * issuance idempotent. If ProgressService's completion hook fires twice
   * for the same student (e.g. a retried job), we don't want two certs.
   */
  async findExisting(
    userId: ObjectId,
    courseId: ObjectId,
    courseVersionId: ObjectId,
  ): Promise<ICertificate | null> {
    await this.init();
    return this.certificateCollection.findOne({userId, courseId, courseVersionId});
  }

  async create(certificate: ICertificate): Promise<ICertificate> {
    await this.init();
    const result = await this.certificateCollection.insertOne(certificate);
    return {...certificate, _id: result.insertedId};
  }

  async findByCertificateId(certificateId: string): Promise<ICertificate | null> {
    await this.init();
    return this.certificateCollection.findOne({certificateId});
  }

  async findAllForUser(userId: ObjectId): Promise<ICertificate[]> {
    await this.init();
    return this.certificateCollection.find({userId}).toArray();
  }
}

export {CertificateRepository};
