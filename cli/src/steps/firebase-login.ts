#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { findProjectRoot } from "../findRoot.ts";

const stateFile = path.resolve(findProjectRoot(), ".vibe.json");

// Constants
const STEP_NAME = "Firebase Login";

// Read setup state
function readState(): Record<string, any> {
  if (fs.existsSync(stateFile)) {
    return JSON.parse(fs.readFileSync(stateFile, "utf-8"));
  }
  return {};
}

// Write setup state
function writeState(state: Record<string, any>) {
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

// Load state
const state = readState();

// Skip if already logged in
if (state[STEP_NAME]) {
  console.log("✅ Firebase login already verified. Skipping.");
  process.exit(0);
}

console.log("🔐 Checking Firebase login...");

try {
  const result = execSync("firebase login:list", {
    encoding: "utf-8",
    stdio: "pipe" // So we can capture the output
  });

  if (result.includes("No authorized accounts")) {
    console.log("🔓 No authorized Firebase accounts found. Logging in...");
    execSync("firebase login", { stdio: "inherit" });
  } else {
    console.log("✅ Firebase already logged in.");
  }
} catch (err) {
  console.error("❌ Error checking Firebase login status.");
  process.exit(1);
}

// Mark step complete
state[STEP_NAME] = true;
writeState(state);
console.log("✅ Firebase login step complete.");
