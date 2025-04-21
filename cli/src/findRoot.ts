import { cwd } from "process";
import path from "path";

export function findProjectRoot(): string | null {
    const currentPath = cwd();
    const segments = currentPath.split(path.sep);
    const vibeIndex = segments.lastIndexOf("vibe");
  
    if (vibeIndex === -1) {
      return null;
    }
  
    // Reconstruct path up to /vibe
    const rootPath = segments.slice(0, vibeIndex + 1).join(path.sep);
    return rootPath;
  }