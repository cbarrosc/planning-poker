import { afterEach, expect, it, vi } from 'vitest';
import { newRequestId } from './requestId';

afterEach(() => vi.unstubAllGlobals());

it('genera UUID seguros en HTTP local sin randomUUID', () => {
  const crypto = globalThis.crypto;
  vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
  const ids = Array.from({ length: 100 }, () => newRequestId());
  expect(new Set(ids).size).toBe(100);
  for (const id of ids)
    expect(id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
});
