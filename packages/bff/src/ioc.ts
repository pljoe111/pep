/**
 * tsoa IoC module — bridges tsyringe DI container to tsoa controller instantiation.
 * tsoa calls iocContainer.get(ControllerClass) for every request; we delegate to tsyringe.
 * Coding rules §3.4: all registrations in container.ts, this file only bridges.
 */
import type { IocContainer } from 'tsoa';
import { container } from './container';

export const iocContainer: IocContainer = {
  get<T>(constructor: { new (...args: never[]): T }): T {
    // SAFETY: constructor is always a class decorated with @injectable() registered in container.ts.
    // The never/any discrepancy is a TypeScript generics mismatch between tsoa's IocContainer
    // interface and tsyringe's InjectionToken type; at runtime they are fully compatible.
    return container.resolve<T>(constructor as unknown as new (...args: unknown[]) => T);
  },
};
