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

  // Determine which services to start
  const startBackend = args.includes('backend') || (!args.includes('backend') && !args.includes('frontend') && !args.includes('docs'));
  const startFrontend = args.includes('frontend') || (!args.includes('backend') && !args.includes('frontend') && !args.includes('docs'));
  const startDocs = args.includes('docs');

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

    await Promise.all(processes);
  } catch (err) {
    console.error("❌ One or more services failed to start.");
    process.exit(1);
  }
}
