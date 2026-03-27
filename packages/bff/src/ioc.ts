/**
 * tsoa IoC module — bridges tsyringe DI container to tsoa controller instantiation.
 * tsoa calls iocContainer.get(ControllerClass) for every request; we delegate to tsyringe.
 * Coding rules §3.4: all registrations in container.ts, this file only bridges.
 *
 * Controllers do NOT need @injectable() applied manually — this bridge applies it
 * programmatically before each resolution, so any controller class works out of the box.
 */
import type { IocContainer } from 'tsoa';
import { injectable } from 'tsyringe';
import { container } from './container';

export const iocContainer: IocContainer = {
  get<T>(constructor: { new (...args: never[]): T }): T {
    // Apply @injectable() dynamically so controllers never need the decorator themselves.
    // Calling injectable() multiple times on the same class is idempotent (tsyringe just
    // overwrites the same reflect-metadata key).
    injectable()(constructor as unknown as new (...args: unknown[]) => T);

    // SAFETY: constructor is always a class registered via tsoa's controllerPathGlobs.
    // The never/any discrepancy is a TypeScript generics mismatch between tsoa's IocContainer
    // interface and tsyringe's InjectionToken type; at runtime they are fully compatible.
    return container.resolve<T>(constructor as unknown as new (...args: unknown[]) => T);
  },
};
