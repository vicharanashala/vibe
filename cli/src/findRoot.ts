import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Function to get the root directory of the Git repo
function getGitRootDir() {
    try {
        // Check if inside a Git repo
        const gitRootDir = execSync('git rev-parse --show-toplevel').toString().trim();
        return gitRootDir;
    } catch (err) {
        console.error('Not inside a Git repository.');
        return null;
    }
}

// Function to check the repository name in package.json
function checkRepoName(rootDir) {
    try {
        const packageJsonPath = path.join(rootDir, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        const expectedRepoName = 'vibe';
        if (packageJson.name === expectedRepoName) {
            return true;
        } else {
            return false;
        }
    } catch (err) {
        console.error('Error reading package.json:', err);
        return false;
    }
}

export function findProjectRoot() {
const rootDir = getGitRootDir();
if (rootDir) {
    if (checkRepoName(rootDir)) {
        return rootDir;
    } else {
        return null
    }
} else {
  return null
}
}
