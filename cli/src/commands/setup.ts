import { spawnSync } from "child_process";
import os from "os";
import path from "path";
import { findProjectRoot } from "../findRoot.ts";

function runStep(file: string) {
    const isWindows = os.platform() === "win32";
    // run files in ../steps/
    const result = spawnSync('pnpx', ['ts-node', file], {
        cwd: path.join(findProjectRoot(),"cli","src","steps"),
        stdio: "inherit",
        shell: isWindows
    });
    if (result.error) {
        console.error(`Error running ${file}:`, result.error);
        process.exit(1);
    }
    else{
        //clear the console
        console.clear();
    }
}

export function runSetup() {
    runStep("welcome.ts");
    // runStep("firebase-login.ts");
    runStep("firebase-emulators.ts");
    runStep("mongodb-binary.ts");
    runStep("env.ts");
}