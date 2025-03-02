import mongoose from "mongoose";
import config from "config";
import { dbConfig } from "@config/db";

export async function connectToMongo() {
  try {
    await mongoose.connect(dbConfig.url, {
      dbName: dbConfig.dbName,
  });
    console.log("Connected to Database");
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}