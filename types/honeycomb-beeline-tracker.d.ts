// This is used by our instrumentation tests to ensure consistent span IDs
// The approach is cribbed from the tests in the original beeline package
//
// Here we're only specifying enough of the module's interface to satisfy
// the type checker.

declare module 'honeycomb-beeline/lib/async_tracker' {
  interface Context {
    id: number;
    spanId: number;
    stack: unknown[];
  }
  export function setTracked(value: Context | null);
}
