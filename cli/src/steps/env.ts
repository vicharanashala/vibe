#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { findProjectRoot } from "../findRoot.ts";
import password from '@inquirer/password';

const rootDir = findProjectRoot();
const backendDir = path.join(rootDir, "backend");
const statePath = path.join(rootDir, ".vibe.json");
const envPath = path.join(backendDir, ".env");

// Constants
const STEP_NAME = "Env Variables";

function maskMongoUri(uri: string): string {
  return uri.replace(/:\/\/([^:@/]+):([^@]+)@/, '://$1:****@');
}

async function getMongoUri() {
  const mongoUri = await password({
    message: 'Enter your MongoDB connection URI (ask a maintainer for this):',
    mask: '*',
  });

  if (!isValidMongoUri(mongoUri)) {
    throw new Error('Invalid MongoDB URI. It must start with "mongodb://" or "mongodb+srv://".');
  }

  console.log(`\nMongoDB URI: ${maskMongoUri(mongoUri)}`);

  return mongoUri;
}

// Read state
function readState(): Record<string, any> {
  if (fs.existsSync(statePath)) {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  }
  return {};
}

// Write state
function writeState(state: Record<string, any>) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

// Validate MongoDB URI
function isValidMongoUri(uri: string): boolean {
  return uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://");
}

const state = readState();

if (state[STEP_NAME]) {
  console.log("✅ Environment variables already set. Skipping.");
  process.exit(0);
}

console.log(`
📄 Creating .env file for MongoDB
`);

const mongoUri = await getMongoUri();

// Write to .env file
fs.writeFileSync(envPath, `DB_URL="${mongoUri}"\nFIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099\nFIREBASE_EMULATOR_HOST=127.0.0.1:4000\nGCLOUD_PROJECT=demo-test`);
console.log(`✅ Wrote MongoDB URI to ${envPath}`);

// Save step complete
state[STEP_NAME] = true;
writeState(state);
