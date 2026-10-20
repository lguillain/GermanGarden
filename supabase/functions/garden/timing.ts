// Shared by HTTP instrumentation and database adapters.
export type Measure = <T>(name: string, operation: () => PromiseLike<T>) => Promise<T>;
