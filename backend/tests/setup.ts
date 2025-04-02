// import { MongoMemoryServer } from "mongodb-memory-server";
// import mongoose from "mongoose";
// import "reflect-metadata"; // Ensure decorators work

// let mongoServer: MongoMemoryServer;

// beforeAll(async () => {
//   mongoServer = await MongoMemoryServer.create();
//   const mongoUri = mongoServer.getUri();
//   await mongoose.connect(mongoUri);
// });

// afterAll(async () => {
//   await mongoose.disconnect();
//   await mongoServer.stop();
// });
