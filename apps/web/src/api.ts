import type { Command, CreateSessionInput, SessionSnapshot } from '@poker/shared';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function request<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok)
    throw new ApiError(res.status, data.error?.message ?? 'No pudimos completar la solicitud.');
  return data;
}
let identityPromise: Promise<unknown> | undefined;
function ensureIdentity() {
  return (identityPromise ??= request('/api/identity').catch((error) => {
    identityPromise = undefined;
    throw error;
  }));
}
export const api = {
  get: (code: string) => request<SessionSnapshot>(`/api/sessions/${code}`),
  create: async (input: CreateSessionInput) => {
    await ensureIdentity();
    return request<SessionSnapshot>('/api/sessions', input);
  },
  join: async (code: string, participantName: string) => {
    await ensureIdentity();
    return request<SessionSnapshot>(`/api/sessions/${code}/join`, { participantName });
  },
  command: (code: string, command: Command) =>
    request<SessionSnapshot>(`/api/sessions/${code}/commands`, command),
};
