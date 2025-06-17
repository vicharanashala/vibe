const fs = require('fs');
const path = require('path');

module.exports = function (plop) {
  plop.setGenerator('module-asset', {
    description: 'Generate controller/service/repository and update DI setup',
    prompts: [
      {
        type: 'input',
        name: 'module',
        message: 'Module name (e.g., quizzes, courses):',
      },
      {
        type: 'checkbox',
        name: 'components',
        message: 'What would you like to generate?',
        choices: ['controller', 'service', 'repository'],
      },
      {
        type: 'input',
        name: 'name',
        message: 'Base name (e.g., Question):',
      },
    ],
    actions: function (data) {
      const actions = [];

      const {module, name, components} = data;
      const basePath = `src/modules/${module}`;

      // ✅ Create missing base files if needed
      ['index.ts', 'container.ts', 'types.ts'].forEach(file => {
        const filePath = `${basePath}/${file}`;
        if (!fs.existsSync(filePath)) {
          actions.push({
            type: 'add',
            path: filePath,
            templateFile: `plop-templates/module-base/${file}.hbs`,
            data: {module},
          });
        }
      });

      // ✅ Add component files
      if (components.includes('controller')) {
        actions.push({
          type: 'add',
          path: `${basePath}/controllers/{{name}}Controller.ts`,
          templateFile: 'plop-templates/controller.hbs',
        });
      }

      if (components.includes('service')) {
        actions.push({
          type: 'add',
          path: `${basePath}/services/{{name}}Service.ts`,
          templateFile: 'plop-templates/service.hbs',
          data: {
            service: components.includes('service'),
            repository: components.includes('repository'),
          },
        });
      }

      if (components.includes('repository')) {
        actions.push({
          type: 'add',
          path: `${basePath}/repositories/providers/mongodb/{{name}}Repository.ts`,
          templateFile: 'plop-templates/repository.hbs',
        });
      }

      if (components.includes('controller')) {
        actions.push({
          type: 'append',
          path: `${basePath}/index.ts`,
          pattern: /^(import .*?;[\r\n]+)/m,
          template: `import { {{name}}Controller } from './controllers/{{name}}Controller.js';`,
          separator: '',
        });
        actions.push({
          type: 'append',
          path: `${basePath}/container.ts`,
          pattern: /^(import .*?;[\r\n]+)/m,
          template: `import { {{name}}Controller } from './controllers/{{name}}Controller.js';`,
          separator: '',
        });
      }
      if (components.includes('service')) {
        actions.push({
          type: 'append',
          path: `${basePath}/container.ts`,
          pattern: /^(import .*?;[\r\n]+)/m,
          template: `import { {{name}}Service } from './services/{{name}}Service.js';`,
          separator: '',
        });
      }
      if (components.includes('repository')) {
        actions.push({
          type: 'append',
          path: `${basePath}/container.ts`,
          pattern: /^(import .*?;[\r\n]+)/m,
          template: `import { {{name}}Repository } from './repositories/providers/mongodb/{{name}}Repository.js';`,
          separator: '',
        });
      }

      // ✅ Modify types.ts
      actions.push({
        type: 'modify',
        path: `${basePath}/types.ts`,
        pattern: /(const TYPES = {)/,
        template: `$1
  {{#if (includes components "controller")}}{{name}}Controller: Symbol.for('{{name}}Controller'),
  {{/if}}{{#if (includes components "service")}}{{name}}Service: Symbol.for('{{name}}Service'),
  {{/if}}{{#if (includes components "repository")}}{{name}}Repo: Symbol.for('{{name}}Repo'),
  {{/if}}`,
      });

      // ✅ Modify container.ts
      actions.push({
        type: 'modify',
        path: `${basePath}/container.ts`,
        pattern:
          /(export const .*ContainerModule = new ContainerModule\(options => {)/,
        template: `$1
  {{#if (includes components "repository")}}options.bind({{constantCase module}}_TYPES.{{name}}Repo).to({{name}}Repository).inSingletonScope();
  {{/if}}{{#if (includes components "service")}}options.bind({{constantCase module}}_TYPES.{{name}}Service).to({{name}}Service).inSingletonScope();
  {{/if}}{{#if (includes components "controller")}}options.bind({{name}}Controller).toSelf().inSingletonScope();
  {{/if}}`,
      });

      // ✅ Modify index.ts
      actions.push({
        type: 'modify',
        path: `${basePath}/index.ts`,
        pattern: /(export const .*ModuleControllers: Function\[] = \[)/,
        template: `$1
  {{#if (includes components "controller")}}{{name}}Controller,
  {{/if}}`,
      });

      // ✅ Update package.json imports
actions.push(() => {
  const pkgPath = path.resolve('package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

  const importKey = `#${module}/*.js`;
  const importValue = `./build/modules/${module}/*.js`;

  if (!pkg.imports) pkg.imports = {};
  if (!pkg.imports[importKey]) {
    pkg.imports[importKey] = importValue;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    return `✅ Updated package.json imports with module '${module}'`;
  }

  return `ℹ️ package.json already contains import for module '${module}'`;
});

// ✅ Update tsconfig.json paths
actions.push(() => {
  const tsconfigPath = path.resolve('tsconfig.json');
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));

  const pathsKey = `#${module}/*`;
  const pathsValue = [`./modules/${module}/*`];

  if (!tsconfig.compilerOptions) tsconfig.compilerOptions = {};
  if (!tsconfig.compilerOptions.paths) tsconfig.compilerOptions.paths = {};
  if (!tsconfig.compilerOptions.paths[pathsKey]) {
    tsconfig.compilerOptions.paths[pathsKey] = pathsValue;
    fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
    return `✅ Updated tsconfig.json paths with module '${module}'`;
  }

  return `ℹ️ tsconfig.json already contains path for module '${module}'`;
});


      return actions;
    },
  });

  // ✅ FIXED: Inline helper (returns Boolean)
  plop.setHelper('includes', function (array, value) {
    return array.includes(value);
  });

  plop.setHelper('injects', function (base, hasInject) {
    return hasInject ? `${base}, inject` : base;
  });

  // Helper to convert to CONSTANT_CASE
  plop.setHelper('constantCase', function (str) {
    return str.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  });
};
