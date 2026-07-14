import { Container, ContainerModule } from 'inversify';
import { InversifyAdapter } from '#root/inversify-adapter.js';
import { useContainer } from 'routing-controllers';
import { securityContainerModule } from './container.js';
import { SecurityController } from './controllers/index.js';
import { sharedContainerModule } from '#root/container.js';

export const securityContainerModules: ContainerModule[] = [
  securityContainerModule,
  sharedContainerModule,
];

export const securityModuleControllers: Function[] = [SecurityController];
export const securityModuleValidators: Function[] = [];

export async function setupSecurityContainer(): Promise<void> {
  const container = new Container();
  await container.load(...securityContainerModules);
  const inversifyAdapter = new InversifyAdapter(container);
  useContainer(inversifyAdapter);
}
