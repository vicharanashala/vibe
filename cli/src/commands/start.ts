import { spawn } from "child_process";
import os from "os";
import path from "path";
import net from "net";
import { findProjectRoot } from "../findRoot.ts";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  printBanner,
  printServiceBoard,
  StepLogger,
  section,
  ok, warn, info, err, sep,
  clr,
  type ServiceInfo,
} from "../ui.ts";

// ── Port helper ───────────────────────────────────────────────────────────────
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (e: any) => resolve(e.code === "EADDRINUSE"));
    server.once("listening", () => { server.close(); resolve(false); });
    server.listen(port);
  });
}

// ── Process launchers ─────────────────────────────────────────────────────────
function runProcess(
  name: string,
  cwd: string,
  script: string = "dev",
  onReady?: () => void
) {
  return new Promise<void>((resolve, reject) => {
    const isWindows = os.platform() === "win32";
    const proc = spawn("pnpm", ["run", script], {
      cwd,
      stdio: "inherit",
      shell: isWindows,
    });

    // Fire onReady shortly after process spawns (no reliable "ready" signal from pnpm)
    if (onReady) setTimeout(onReady, 3000);

    proc.on("exit", (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`${name} exited with code ${code}`));
    });

    proc.on("error", reject);
  });
}

function runFirebaseEmulator(
  name: string,
  cwd: string,
  emulatorName: string = "auth",
  onReady?: () => void
) {
  return new Promise<void>((resolve, reject) => {
    const isWindows = os.platform() === "win32";
    const proc = spawn("firebase", ["emulators:start", "--only", emulatorName], {
      cwd,
      stdio: "inherit",
      shell: isWindows,
    });

    if (onReady) setTimeout(onReady, 5000);

    proc.on("exit", (code) => {
      if (code === 0 || code === null) resolve();
      else reject(new Error(`${name} exited with code ${code}`));
    });

    proc.on("error", reject);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
export async function runStart() {
  printBanner();

  const root = findProjectRoot();
  if (!root) {
    err("Please run this command from within the vibe project directory.");
    process.exit(1);
  }

  const backendDir  = path.join(root, "backend");
  const frontendDir = path.join(root, "frontend");
  const docsDir     = path.join(root, "docs");

  // ── Parse args ──────────────────────────────────────────────────────────────
  const args = process.argv.slice(2);

  if (args.includes("help")) {
    console.log();
    console.log(clr.bold("  Usage:") + "  vibe start [backend|frontend|docs|all]");
    console.log();
    console.log("  Options:");
    console.log(`    ${clr.cyan("backend")}   Start the backend service (+ MongoDB + Firebase Auth)`);
    console.log(`    ${clr.cyan("frontend")}  Start the frontend Vite dev server`);
    console.log(`    ${clr.cyan("docs")}      Start the documentation site`);
    console.log(`    ${clr.cyan("all")}       Start all services`);
    console.log();
    process.exit(0);
  }

  const startBackend  = args.includes("backend")  || args.length === 1 || args.includes("all");
  const startFrontend = args.includes("frontend") || args.length === 1 || args.includes("all");
  const startDocs     = args.includes("docs")     || args.includes("all");

  const hasAuthArg      = args.includes("auth")      || args.includes("emulators") || args.includes("all");
  const hasFunctionsArg = args.includes("functions") || args.includes("emulators") || args.includes("all");

  let startAuthEmu      = hasAuthArg;
  let startFunctionsEmu = hasFunctionsArg;

  if (!startBackend && !startFrontend && !startDocs && !startAuthEmu && !startFunctionsEmu) {
    err("No valid arguments provided. Run  vibe start help  for usage.");
    process.exit(1);
  }

  // ── Pre-start checks ─────────────────────────────────────────────────────────
  section("Pre-flight checks");
  const steps = new StepLogger();

  // Check Firebase Auth Emulator port
  let authIdx = -1;
  if (startBackend) {
    authIdx = steps.add("Firebase Auth Emulator (port 9099)");
    steps.update(authIdx, "running", "checking...");
    const authPortInUse = await isPortInUse(9099);
    if (!authPortInUse) {
      steps.update(authIdx, "ok", "port free — will auto-start");
      startAuthEmu = true;
    } else {
      steps.update(authIdx, "skip", "port 9099 already in use — using existing");
    }
  }

  // Check MongoDB port
  let mongoIdx = -1;
  let mongod: MongoMemoryServer | null = null;
  if (startBackend) {
    mongoIdx = steps.add("MongoDB (port 27017)");
    steps.update(mongoIdx, "running", "checking...");
    const mongoPortInUse = await isPortInUse(27017);
    if (!mongoPortInUse) {
      steps.update(mongoIdx, "running", "starting MongoDB Memory Server...");
      try {
        mongod = await MongoMemoryServer.create({
          instance: { port: 27017, dbName: "vibe" },
        });
        steps.update(mongoIdx, "ok", `running at ${mongod.getUri()}`);
      } catch (e: any) {
        steps.update(mongoIdx, "error", e.message);
        process.exit(1);
      }
    } else {
      steps.update(mongoIdx, "skip", "port 27017 already in use — using existing");
    }
  }

  // ── Build service list for status board ──────────────────────────────────────
  const services: ServiceInfo[] = [];
  if (startBackend)  services.push({ name: "Backend API",          url: "http://localhost:3141",           status: "starting" });
  if (startFrontend) services.push({ name: "Frontend",             url: "http://localhost:5173",           status: "starting" });
  if (startDocs)     services.push({ name: "Docs",                 url: "http://localhost:3000",           status: "starting" });
  if (startAuthEmu)  services.push({ name: "Firebase Auth Emu",    url: "http://localhost:9099",           status: "starting" });
  if (startBackend)  services.push({ name: "API Reference",        url: "http://localhost:3141/reference", status: "starting" });
  if (mongod)        services.push({ name: "MongoDB Memory Server", url: "mongodb://localhost:27017/vibe", status: "up" });

  // ── Graceful cleanup ──────────────────────────────────────────────────────────
  const cleanup = async () => {
    console.log();
    warn("Shutting down services...");
    if (mongod) {
      info("Stopping MongoDB Memory Server...");
      await mongod.stop();
      ok("MongoDB Memory Server stopped.");
    }
    process.exit(0);
  };

  process.on("SIGINT",  cleanup);
  process.on("SIGTERM", cleanup);

  // ── Launch ────────────────────────────────────────────────────────────────────
  section("Starting services");
  console.log();

  // Show status board immediately (all "starting")
  printServiceBoard(services);

  // After a delay, refresh the board showing services as "up"
  const markUp = (name: string) => {
    const svc = services.find((s) => s.name === name);
    if (svc) svc.status = "up";
  };

  try {
    const procs: Promise<void>[] = [];

    if (startBackend) {
      procs.push(
        runProcess("Backend", backendDir, "dev", () => {
          markUp("Backend API");
          markUp("API Reference");
          sep();
          ok(clr.bold("Backend is ready!") + clr.cyan("  →  http://localhost:3141"));
          info(`API Reference  →  ${clr.cyan("http://localhost:3141/reference")}`);
        })
      );
    }

    if (startFrontend) {
      procs.push(
        runProcess("Frontend", frontendDir, "dev", () => {
          markUp("Frontend");
          sep();
          ok(clr.bold("Frontend is ready!") + clr.cyan("  →  http://localhost:5173"));
        })
      );
    }

    if (startDocs) {
      procs.push(
        runProcess("Docs", docsDir, "start", () => {
          markUp("Docs");
          sep();
          ok(clr.bold("Docs are ready!") + clr.cyan("  →  http://localhost:3000"));
        })
      );
    }

    if (startAuthEmu) {
      procs.push(
        runFirebaseEmulator("Firebase Auth Emulator", backendDir, "auth", () => {
          markUp("Firebase Auth Emu");
          sep();
          ok(clr.bold("Firebase Auth Emulator ready!") + clr.cyan("  →  http://localhost:9099"));
        })
      );
    }

    if (startFunctionsEmu) {
      procs.push(
        runFirebaseEmulator("Firebase Functions Emulator", backendDir, "functions")
      );
    }

    await Promise.all(procs);
  } catch (e: any) {
    err("One or more services failed to start.");
    err(e.message ?? String(e));
    if (mongod) await mongod.stop();
    process.exit(1);
  }
}
