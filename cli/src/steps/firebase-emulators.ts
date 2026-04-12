#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { findProjectRoot } from "../findRoot.ts";

const rootDir = findProjectRoot();
const backendDir = path.join(rootDir, "backend");
const statePath = path.join(rootDir, ".vibe.json");

// Step name for state tracking
const STEP_NAME = "Emulators";

// Load setup state
function readState(): Record<string, any> {
  if (fs.existsSync(statePath)) {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  }
  return {};
}

// Save updated state
function writeState(state: Record<string, any>) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

const state = readState();

// Skip step if already done
if (state[STEP_NAME]) {
  console.log("✅ Firebase emulators already initialized. Skipping.");
  process.exit(0);
}

const firebasercPath = path.join(backendDir, ".firebaserc");
const firebaseJsonPath = path.join(backendDir, "firebase.json");

if (fs.existsSync(firebasercPath) && fs.existsSync(firebaseJsonPath)) {
  console.log("Config files already exist.");
  state[STEP_NAME] = true;
  writeState(state);
  process.exit(0);
}

console.log(`
📦 Initializing Firebase Emulators...

Please choose ONLY the following emulators when prompted:

✔ Authentication Emulator
✔ Functions Emulator
✔ Emulator UI [optional but recommended]
`);

try {
  execSync("firebase init emulators", {
    cwd: backendDir,
    stdio: "inherit"
  });

  state[STEP_NAME] = true;
  writeState(state);

  console.log("✅ Firebase emulators initialized successfully.");
} catch (err) {
  console.error("❌ Failed to initialize Firebase emulators.");
  process.exit(1);
}
