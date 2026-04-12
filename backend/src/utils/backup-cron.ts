import {exec} from 'child_process';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import {MongoClient} from 'mongodb';
import {Bucket, Storage} from '@google-cloud/storage';
import {appConfig} from '#root/config/app.js';

// const folder = 'db_backups';

const getCollectionsFromDB = async (mongoUri: string, dbName: string) => {
  console.log("Connecting to MongoDB to fetch collection list...",mongoUri, dbName);
  const client = new MongoClient(mongoUri);
  await client.connect();
  const collections = await client.db(dbName).listCollections().toArray();
  await client.close();
  return collections.map(c => c.name);
};

const doesBackupExist = async (
  bucket: Bucket,
  dateString: string,
): Promise<boolean> => {
  const [files] = await bucket.getFiles();
  return files.some(f => f.name.includes(dateString));
};

const getTimestamp = () => {
  const now = new Date();
  return (
    `${String(now.getDate()).padStart(2, '0')}-` +
    `${String(now.getMonth() + 1).padStart(2, '0')}-` +
    `${now.getFullYear()}`
  );
};

export const createLocalBackup = async (mongoUri: string, dbName: string) => {
  const timestamp = getTimestamp();

  const storage = new Storage({
    keyFilename: appConfig.GOOGLE_APPLICATION_CREDENTIALS,
  });

  const bucketName = appConfig.GCP_BACKUP_BUCKET;
  const bucket = storage.bucket(bucketName);

  if (await doesBackupExist(bucket, timestamp)) {
    console.log(
      `⚠️ Backup for today (${timestamp}) already exists. Skipping upload.`,
    );
    // await sendStatsEmail();
    return; 
  }

  const tempDir = path.join(process.cwd(), 'temp_db_backup');
  const dumpFolder = path.join(tempDir, dbName);
  const jsonFolder = path.join(tempDir, `${dbName}_json`);
  const zipFileName = `${timestamp}.zip`;
  const zipFilePath = path.join(process.cwd(), zipFileName);

  fs.mkdirSync(tempDir, {recursive: true});
  fs.mkdirSync(jsonFolder, {recursive: true});

  console.log('Running mongodump...');

  // ----------------------------------------------------------
  // 1. BSON BACKUP
  // ----------------------------------------------------------
  await new Promise((resolve, reject) => {
    exec(
      `mongodump --uri="${mongoUri}" --db="${dbName}" --out="${tempDir}"`,
      (err, stdout, stderr) => {
        if (err) return reject(stderr);
        resolve(stdout);
      },
    );
  });

  console.log('Fetching collection list (Node.js)...');

  // ----------------------------------------------------------
  // 2. Get collections
  // ----------------------------------------------------------
  const collections = await getCollectionsFromDB(mongoUri, dbName);

  // ----------------------------------------------------------
  // 3. Export JSON for each collection using mongoexport
  // ----------------------------------------------------------
  for (const col of collections) {
    console.log(`Exporting ${col}.json ...`);
    await new Promise((resolve, reject) => {
      exec(
        `mongoexport --uri="${mongoUri}" --db="${dbName}" --collection="${col}" --out="${path.join(
          jsonFolder,
          col + '.json',
        )}" --jsonArray`,
        err => {
          if (err) return reject(err);
          resolve(true);
        },
      );
    });
  }

  console.log('📦 Compressing database backup...');

  // ----------------------------------------------------------
  // 4. ZIP both BSON & JSON
  // ----------------------------------------------------------
  await new Promise<void>((resolve, reject) => {
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', {zlib: {level: 6}});

    output.on('close', async () => {
      try {
        console.log(`🔄 Uploading ZIP backup to Google Cloud Storage...`);
        await bucket.upload(zipFilePath, {
          destination: `${zipFileName}`,
          gzip: false,
        });

        // Sent mail
        // const publicUrl = `https://console.cloud.google.com/storage/browser/_details/${bucketName}/${zipFileName}`;
        // await sendBackupSuccessEmail(publicUrl);

        console.log(`☁️ Backup uploaded to: gs://${bucketName}/${zipFileName}`);
      } catch (err) {
        console.error('❌ Error uploading ZIP:', err);
      }

      // cleanup
      fs.rmSync(tempDir, {recursive: true, force: true});
      fs.unlinkSync(zipFilePath);

      resolve();
    });

    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(dumpFolder, `bson_backup`);
    archive.directory(jsonFolder, `json_backup`);

    archive.finalize();
  });

  console.log('✅ Backup created:', zipFilePath);
};
