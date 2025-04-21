#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { MongoMemoryServer } from "mongodb-memory-server";
import { findProjectRoot } from "../findRoot.ts";


const rootDir = findProjectRoot();
const statePath = path.join(rootDir, ".vibe.json");

// Step name constant
const STEP_NAME = "MongoDB Test Binaries";

// Read .vibe.json state
function readState(): Record<string, any> {
  if (fs.existsSync(statePath)) {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  }
  return {};
}

// Write updated state
function writeState(state: Record<string, any>) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

// Load state
const state = readState();

if (state[STEP_NAME]) {
  console.log("✅ MongoDB binaries already ensured. Skipping.");
  process.exit(0);
}

console.log("⬇️  Ensuring MongoDB binaries for mongodb-memory-server...");

try {
  const mongod = await MongoMemoryServer.create();
  await mongod.getUri(); // Triggers binary download
  await mongod.stop();

  state[STEP_NAME] = true;
  writeState(state);
  console.log("✅ MongoDB test binaries downloaded and ready.");
} catch (err) {
  console.error("❌ Failed to download MongoDB binaries.");
  console.error(err);
  process.exit(1);
}
