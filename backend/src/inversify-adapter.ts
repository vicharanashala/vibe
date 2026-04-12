import {ClassConstructor} from 'class-transformer';
import {Container} from 'inversify';
import {IocAdapter, Action} from 'routing-controllers';

export class InversifyAdapter implements IocAdapter {
  constructor(private readonly container: Container) {}

  get<T>(someClass: ClassConstructor<T>, action?: Action): T {
    return this.container.get<T>(someClass);
  }
}
