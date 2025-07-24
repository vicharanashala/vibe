import fs from 'fs/promises';
import path from 'path';
import {Container, ContainerModule} from 'inversify';
import {useContainer} from 'routing-controllers';
import {InversifyAdapter} from '#root/inversify-adapter.js';
import { appConfig } from '#root/config/app.js';

interface LoadedModuleResult {
  controllers: Function[];
  validators: Function[];
}

export async function loadAppModules(moduleName: string): Promise<LoadedModuleResult> {
  const isAll = moduleName === 'all';
  let modulesDir;
  if (appConfig.isProduction || appConfig.isStaging) {
    modulesDir = path.resolve('./build/modules');
  }
  else {
    modulesDir = path.resolve('./src/modules');
  }
  const files = await fs.readdir(modulesDir);

  let controllers: Function[] = [];
  let validators: Function[] = [];
  const allContainerModules: ContainerModule[] = [];

  for (const file of files) {
    const modulePath = `../modules/${file}/index.js`;
    const moduleExports = await import(modulePath);

    const controllerExportKey = `${file}ModuleControllers`;
    const validatorExportKey = `${file}ModuleValidators`;
    const containerModulesKey = `${file}ContainerModules`;
    const setupFunctionKey = `setup${file[0].toUpperCase()}${file.slice(1)}Container`;

    if (isAll) {
      controllers.push(...(moduleExports[controllerExportKey] || []));
      validators.push(...(moduleExports[validatorExportKey] || []));
      allContainerModules.push(...(moduleExports[containerModulesKey] || []));
    } else if (file === moduleName) {
      controllers = moduleExports[controllerExportKey] ?? [];
      validators = moduleExports[validatorExportKey] ?? [];
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

  return {controllers, validators};
}

