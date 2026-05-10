import 'reflect-metadata';
import { Container } from 'inversify';

export function createTestContainer(): Container {
  return new Container({ defaultScope: 'Singleton' });
}

export function bindMock<T>(container: Container, identifier: symbol | string, mockInstance: T): void {
  if (container.isBound(identifier as symbol)) container.unbind(identifier as symbol);
  container.bind(identifier as symbol).toConstantValue(mockInstance);
}

export function bindRealRepoToTestDb<T>(container: Container, identifier: symbol | string, repoFactory: () => T): void {
  if (container.isBound(identifier as symbol)) container.unbind(identifier as symbol);
  container.bind(identifier as symbol).toDynamicValue(() => repoFactory()).inSingletonScope();
}
