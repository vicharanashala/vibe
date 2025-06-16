import fs from 'fs/promises';
import path from 'path';
import {Container, ContainerModule} from 'inversify';
import {useContainer} from 'routing-controllers';
import {InversifyAdapter} from '#root/inversify-adapter.js';

interface LoadedModuleResult {
  controllers: Function[];
}

export async function loadAppModules(
  moduleName: string,
): Promise<LoadedModuleResult> {
  const isAll = moduleName === 'all';
  const modulesDir = path.resolve('./src/modules');
  const files = await fs.readdir(modulesDir);

  let controllers: Function[] = [];
  const allContainerModules: ContainerModule[] = [];

  for (const file of files) {
    const modulePath = `../modules/${file}/index.js`;
    const moduleExports = await import(modulePath);

    const controllerExportKey = `${file}ModuleControllers`;
    const containerModulesKey = `${file}ContainerModules`;
    const setupFunctionKey = `setup${file[0].toUpperCase()}${file.slice(1)}Container`;

    if (isAll) {
      controllers.push(...(moduleExports[controllerExportKey] || []));
      allContainerModules.push(...(moduleExports[containerModulesKey] || []));
    } else if (file === moduleName) {
      controllers = moduleExports[controllerExportKey] ?? [];
      const setupContainer = moduleExports[setupFunctionKey];
      if (!setupContainer || !controllers.length) {
        throw new Error(`Missing setup or controller export in ${modulePath}`);
      }
      await setupContainer();
    }
  }

  if (isAll) {
    const uniqueModules = Array.from(new Set(allContainerModules));
    const container = new Container();
    await container.load(...uniqueModules);

    const inversifyAdapter = new InversifyAdapter(container);
    useContainer(inversifyAdapter);
  }

  return {controllers};
}
