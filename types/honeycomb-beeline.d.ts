// Extensions to honeycomb because we're using more than the standard public interface

// TODO: remove if/when https://github.com/honeycombio/beeline-nodejs/pull/509 is merged

// This import puts us into module-mode
import 'honeycomb-beeline';

// module declarations inside a module become augmentations and get merged
declare module 'honeycomb-beeline' {
  export interface Beeline {
    _apiForTesting(): {
      sentEvents: Record<string, unknown>[];
      traceId: number;
    };
  }
}
