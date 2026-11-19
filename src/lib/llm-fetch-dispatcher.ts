import { Agent, type Dispatcher } from 'undici';

/**
 * The HTTP dispatcher for provider requests. Node's fetch uses a global undici agent that abandons a response whose
 * headers take more than 300 seconds (and a body that stalls for 300 seconds). A non-streamed provider request sends
 * its headers only when the whole answer is ready, so any generation longer than five minutes failed there, whatever
 * the configured timeout. Provider requests use this agent instead, with both timeouts off: the per-request deadline
 * from Settings → Provider Request Limits (`createLlmRequestSignal`) is the only limit. Other fetches keep Node's
 * defaults. The `undici` package is pinned to the version bundled with Node so the agent matches its fetch.
 */
let dispatcher: Dispatcher | undefined;

export function getLlmFetchDispatcher(): Dispatcher {
  dispatcher ??= new Agent({ headersTimeout: 0, bodyTimeout: 0 });
  return dispatcher;
}
