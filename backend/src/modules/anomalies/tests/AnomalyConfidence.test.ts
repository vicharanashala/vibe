// Verifies AC2 of #1222 ("confidence scores logged in anomaly records"):
// a real per-face confidence value submitted with a face-count anomaly
// passes NewAnomalyData validation and lands in the persisted Mongo
// document via the real AnomalyRepository write path - not just an
// in-memory echo.
import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Container } from 'inversify';
import { describe, it, beforeAll, expect } from 'vitest';
import { ObjectId } from 'mongodb';
import { GLOBAL_TYPES } from '#root/types.js';
import { sharedContainerModule } from '#root/container.js';
import { MongoDatabase } from '#root/shared/database/providers/mongo/MongoDatabase.js';
import { anomaliesContainerModule } from '../container.js';
import { ANOMALIES_TYPES } from '../types.js';
import { AnomalyRepository } from '../repositories/providers/mongodb/AnomalyRepository.js';
import { NewAnomalyData } from '../classes/validators/AnomalyValidators.js';
import { AnomalyType, IAnomalyData } from '../classes/transformers/Anomaly.js';

describe('Anomaly confidence field (#1222 AC2)', () => {
  let anomalyRepository: AnomalyRepository;
  let db: MongoDatabase;

  beforeAll(async () => {
    const container = new Container();
    await container.load(anomaliesContainerModule, sharedContainerModule);
    db = container.get<MongoDatabase>(GLOBAL_TYPES.Database);
    await db.connect();
    anomalyRepository = container.get<AnomalyRepository>(ANOMALIES_TYPES.AnomalyRepository);
  }, 30000);

  it('accepts a real per-face confidence value at the validation layer', async () => {
    // Simulates the multipart form field: NewAnomalyData.confidence has
    // @Type(() => Number) precisely because this arrives as a string over
    // the wire (see AnomalyValidators.ts).
    const dto = plainToInstance(NewAnomalyData, {
      type: AnomalyType.NO_FACE,
      courseId: new ObjectId().toString(),
      versionId: new ObjectId().toString(),
      itemId: new ObjectId().toString(),
      confidence: '0.87',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.confidence).toBe(0.87);
  });

  it('rejects an out-of-range confidence value', async () => {
    const dto = plainToInstance(NewAnomalyData, {
      type: AnomalyType.NO_FACE,
      courseId: new ObjectId().toString(),
      versionId: new ObjectId().toString(),
      itemId: new ObjectId().toString(),
      confidence: '1.4',
    });

    const errors = await validate(dto);

    expect(errors.some(e => e.property === 'confidence')).toBe(true);
  });

  it('persists a submitted confidence value on the stored anomaly record', async () => {
    const submittedConfidence = 0.87;
    const anomaly = new IAnomalyData(
      {
        type: AnomalyType.NO_FACE,
        courseId: new ObjectId().toString(),
        versionId: new ObjectId().toString(),
        itemId: new ObjectId().toString(),
        confidence: submittedConfidence,
      } as NewAnomalyData,
      new ObjectId().toString(),
    );

    const saved = await anomalyRepository.createAnomaly(anomaly);

    expect(saved.confidence).toBe(submittedConfidence);

    // Read back straight from Mongo -- not the in-memory object the
    // repository handed back -- to confirm it actually landed in the
    // stored record, per AC2.
    const stored = await db.database
      .collection('anomaly_records')
      .findOne({ _id: saved._id as unknown as ObjectId });

    expect(stored).not.toBeNull();
    expect(stored.confidence).toBe(submittedConfidence);
  });

  it('omits confidence entirely when the client does not send one', async () => {
    const anomaly = new IAnomalyData(
      {
        type: AnomalyType.NO_FACE,
        courseId: new ObjectId().toString(),
        versionId: new ObjectId().toString(),
        itemId: new ObjectId().toString(),
      } as NewAnomalyData,
      new ObjectId().toString(),
    );

    const saved = await anomalyRepository.createAnomaly(anomaly);

    const stored = await db.database
      .collection('anomaly_records')
      .findOne({ _id: saved._id as unknown as ObjectId });

    expect(stored.confidence).toBeUndefined();
  });
});
