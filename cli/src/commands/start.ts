import { spawn } from "child_process";
import os from "os";
import path from "path";
import { findProjectRoot } from "../findRoot.ts";

function runProcess(name: string, cwd: string, script: string = "dev") {
  return new Promise((resolve, reject) => {
    console.log(`⏳ Starting ${name} in ${cwd} with script '${script}'...`);

    const isWindows = os.platform() === "win32";
    const proc = spawn("pnpm", ["run", script], {
      cwd,
      stdio: "inherit",
      shell: isWindows // shell: true required for Windows
    });

    proc.on("exit", (code) => {
      if (code === 0) {
        console.log(`✅ ${name} exited cleanly.`);
        resolve(true);
      } else {
        console.error(`❌ ${name} exited with code ${code}`);
        reject(new Error(`${name} failed`));
      }
    });
  });
}

function runFirebaseEmulator(name: string, cwd: string, script: string = "dev") {
  return new Promise((resolve, reject) => {
    console.log(`⏳ Starting ${name} in ${cwd} with script '${script}'...`);

    const isWindows = os.platform() === "win32";
    const proc = spawn("firebase", ["emulators:start", "--only", script], {
      cwd,
      stdio: "inherit",
      shell: isWindows // shell: true required for Windows
    });

    proc.on("exit", (code) => {
      if (code === 0) {
        console.log(`✅ ${name} exited cleanly.`);
        resolve(true);
      } else {
        console.error(`❌ ${name} exited with code ${code}`);
        reject(new Error(`${name} failed`));
      }
    });
  });
}


export async function runStart() {
  console.log("🚀 Launching services...");

  const root = findProjectRoot();

  if (!root) {
    console.error("❌ Please run this command from within the vibe project directory.");
    process.exit(1);
  }

  const backendDir = path.join(root, "backend");
  const frontendDir = path.join(root, "frontend");
  const docsDir = path.join(root, "docs");

  // Extract command-line arguments
  const args = process.argv.slice(2);
  if (args.includes("help")){
    console.log("Usage: vibe start [backend|frontend|docs|all]");
    console.log("Starts the specified services. If no arguments are provided, Frontend and Backend services will be started.");
    console.log("Options:");
    console.log("  backend  Start the backend service");
    console.log("  frontend Start the frontend service");
    console.log("  docs     Start the documentation service");
    console.log("  all      Start all services");
    process.exit(0);
  }
  // Determine which services to start
  const startBackend = args.includes('backend') || args.length === 1 || args.includes('all');
  const startFrontend = args.includes('frontend') || args.length === 1 || args.includes('all');
  const startDocs = args.includes('docs') || args.includes('all');
  const startAuthEmu = args.includes('auth') || args.includes('emulators') || args.includes('all');
  const startFunctionsEmu = args.includes('functions') || args.includes('emulators') || args.includes('all');

  if (!startBackend && !startFrontend && !startDocs && !startAuthEmu && !startFunctionsEmu) {
    console.error("❌ Incorrect args passed.");
    process.exit(1);
  }

  try {
    const processes = [];

    if (startBackend) {
      processes.push(runProcess("Backend", backendDir, "dev"));
    }

    if (startFrontend) {
      processes.push(runProcess("Frontend", frontendDir, "dev"));
    }

    if (startDocs) {
      processes.push(runProcess("Docs", docsDir, "start"));
    }

    if (startAuthEmu) {
      processes.push(runFirebaseEmulator("Firebase Auth Emulator", backendDir, "auth"));
    }

    if (startFunctionsEmu) {
      processes.push(runFirebaseEmulator("Firebase Functions Emulator", backendDir, "functions"));
    }

    await Promise.all(processes);
  } catch (err) {
    console.error("❌ One or more services failed to start.");
    process.exit(1);
  }
}
