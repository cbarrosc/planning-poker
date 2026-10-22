import { afterEach, expect, it, vi } from 'vitest';
import { api } from './api';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it.each(['headers', 'body'])(
  'interrumpe una respuesta bloqueada en %s a los 15 segundos',
  async (stage) => {
    vi.useFakeTimers();
    let signal!: AbortSignal;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url, init) => {
        signal = init.signal;
        const pending = () =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
          });
        return stage === 'headers' ? pending() : Promise.resolve({ ok: true, json: pending });
      }),
    );
    const outcome = api.get('TESTCODE').catch((error) => error);
    await vi.advanceTimersByTimeAsync(14999);
    expect(signal?.aborted ?? false).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(signal!.aborted).toBe(true);
    expect(await outcome).toBeInstanceOf(Error);
  },
);

it('libera el temporizador al recibir la respuesta', async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ revision: 1 }) }),
  );
  expect(await api.get('TESTCODE')).toEqual({ revision: 1 });
  expect(vi.getTimerCount()).toBe(0);
});
