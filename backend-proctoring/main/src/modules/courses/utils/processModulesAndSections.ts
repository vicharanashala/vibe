import { IModule } from "shared/interfaces/IUser";
import { DTOCourseVersionPayload } from "../dtos/DTOCoursePayload";

/**
 * Validates and ensures correct ordering of modules and sections.
 * Sets `isLast` to `true` for the last module and section within each module.
 *
 * @param modules - List of modules to process.
 * @throws Error if module or section order is incorrect.
 */
export function processModulesAndSections(
  modules: DTOCourseVersionPayload["modules"]
): IModule[] {
  if (!modules.length) throw new Error("Course must have at least one module.");

  // Sort modules by order and validate sequence
  modules.sort((a, b) => a.order - b.order);
  for (let i = 0; i < modules.length; i++) {
    if (modules[i].order !== i + 1) {
      throw new Error(
        `Module order is incorrect. Expected ${i + 1} but found ${
          modules[i].order
        }.`
      );
    }

    // Process sections inside the module
    modules[i].sections.sort((a, b) => a.order - b.order);
    for (let j = 0; j < modules[i].sections.length; j++) {
      if (modules[i].sections[j].order !== j + 1) {
        throw new Error(
          `Section order in module '${
            modules[i].name
          }' is incorrect. Expected ${j + 1} but found ${
            modules[i].sections[j].order
          }.`
        );
      }

      // Set `isLast` correctly
      modules[i].sections[j].isLast = j === modules[i].sections.length - 1;
    }

    // Set `isLast` correctly for the module
    modules[i].isLast = i === modules.length - 1;
  }

  return modules;
}
