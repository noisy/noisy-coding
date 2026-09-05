import { onScopeDispose } from 'vue';

interface SpeechTests {
  engine: string;
  tests: { file: string; seconds: number; expected: string }[];
}
interface SpeechRun { file: string; path: string }

/** Mock only the status board's endpoints, for the lifetime of its story. */
export function useSpeechFixture(
  tests: SpeechTests,
  delayMs: number,
  runPayload: (body: SpeechRun) => unknown,
): void {
  const originalFetch = window.fetch;
  const fixtureFetch: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (url.origin === window.location.origin) {
      if (url.pathname === '/tests/speech' && method === 'GET') {
        return Response.json(tests);
      }
      if (url.pathname === '/tests/speech/run' && method === 'POST') {
        const body = init?.body ?? (input instanceof Request ? await input.clone().text() : '{}');
        const payload = runPayload(JSON.parse(String(body)));
        return new Promise(resolve => setTimeout(() => resolve(Response.json(payload)), delayMs));
      }
    }
    return originalFetch(input, init);
  };
  window.fetch = fixtureFetch;
  onScopeDispose(() => {
    if (window.fetch === fixtureFetch) window.fetch = originalFetch;
  });
}
