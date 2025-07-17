/**
 * @author Javier Muñoz Tous <javimtib92@gmail.com>
 *
 * class-transformer version 0.5.1 patch
 *
 * This patch aims to address an inconvenience introduced in class-transformer version 0.3.2 making storage module no longer
 * exposed as a public module.
 *
 * While we wait for this PR to be merged [feat(export): export defaultMetadataStorage](https://github.com/typestack/class-transformer/pull/1715)
 * we decided to introduce this patch as a quick workaround to avoid importing the customjs version of the class-transformer files in vite.
 *
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = getDirname();

(() => {
  const nodeModulesDir = path.join(findRootWithPackageJson(), "node_modules");

  const classTransformerDir = path.join(nodeModulesDir, "class-transformer");

  const classTransformerPackageFile = getPackageJson(classTransformerDir);

  if (classTransformerPackageFile.version !== "0.5.1") {
    console.warn("Warning: class-transformer-0.5.1.patch is being applied to a different version. Please verify if this patch is still necessary.");
  }

  const items = fs.readdirSync(classTransformerDir);

  // Iterate over the items and filter only directories
  for (const item of items) {
    const itemPath = path.join(classTransformerDir, item);

    if (!fs.statSync(itemPath).isDirectory()) {
      continue;
    }

    const subItems = fs.readdirSync(itemPath);

    for (const subItem of subItems) {
      const subItemPath = path.join(itemPath, subItem);

      // Check if the subItem is a file and does not have the .map extension
      if (fs.statSync(subItemPath).isFile() && subItem.startsWith("index") && path.extname(subItem) !== ".map") {
        let fileContent = fs.readFileSync(subItemPath, "utf-8");
        let modifiedContent = fileContent;

        const comment = `/**\n * This file has been modified by patch "class-transformer-0.5.1.patch.js.\n * The patch introduces changes to append storage exports in 'cjs', 'esm5', and 'esm2025' module types.\n */\n\n`;

        if (!fileContent.startsWith(comment)) {
          modifiedContent = comment + modifiedContent;
        } else {
          // If patch was already applied to this file we exit early
          console.error(`Patch class-transformer-0.5.1.patch is already applied. Skipping...`);

          return;
        }

        switch (item) {
          case "cjs": {
            const searchLine = '__exportStar(require("./enums"), exports);';
            const appendLine = '__exportStar(require("./storage"), exports);';

            if (fileContent.includes(searchLine)) {
              modifiedContent = modifiedContent.replace(searchLine, `${searchLine}\n${appendLine}`);
            }

            break;
          }
          case "esm5":
          case "types":
          case "esm2015": {
            const searchLine = "export * from './enums';";
            const appendLine = "export * from './storage';";

            if (fileContent.includes(searchLine)) {
              modifiedContent = modifiedContent.replace(searchLine, `${searchLine}\n${appendLine}`);
            }
            break;
          }
        }

        if (modifiedContent.length !== fileContent.length) {
          fs.writeFileSync(subItemPath, modifiedContent, "utf-8");
        }
      }
    }
  }

  console.log(`\x1b[32m Applied class-transformer-0.5.1.patch  \x1b[0m`);
})();

function getDirname() {
  try {
    return __dirname;
  } catch {
    const __filename = fileURLToPath(import.meta.url);

    const __dirname = path.dirname(__filename);

    return __dirname;
  }
}

function getPackageJson(currentDir = __dirname) {
  const packageJsonPath = path.join(currentDir, "package.json");

  if (fs.existsSync(packageJsonPath)) {
    const content = fs.readFileSync(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);
    return packageJson;
  } else {
    throw new Error("class-transformer package not found");
  }
}

/**
 * Search the neareast directory that contains a package.json file.
 * @param {string} currentDir
 * @returns
 */
function findRootWithPackageJson(currentDir = __dirname) {
  const packagePath = path.join(currentDir, "package.json");

  if (fs.existsSync(packagePath)) {
    return currentDir;
  }

  const parentDir = path.resolve(currentDir, "..");
  if (parentDir === currentDir) {
    throw new Error("package.json not found in any parent directory");
  }

  return findRootWithPackageJson(parentDir);
}