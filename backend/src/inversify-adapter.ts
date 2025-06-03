// src/core/inversify-adapter.ts
import {IocAdapter, Action, ClassConstructor} from 'routing-controllers';
import {Container} from 'inversify';

export class InversifyAdapter implements IocAdapter {
  constructor(private readonly container: Container) {}

  get<T>(someClass: ClassConstructor<T>, action?: Action): T {
    return this.container.get<T>(someClass);
  }
}
