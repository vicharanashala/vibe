import { ApiError, createApiClient, unwrap } from './index.js';

function mockFetch(...responses: Response[]) {
  const calls: Request[] = [];
  const fn = vi.fn(async (input: Request) => {
    calls.push(input.clone());
    return responses.shift() ?? new Response('{}', { status: 200 });
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('createApiClient', () => {
  it('sends the Firebase ID token as a bearer token', async () => {
    const calls = mockFetch(new Response('{"signed":false}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const api = createApiClient({ baseUrl: 'http://api.test', getToken: async () => 'tok-1' });
    const res = await api.GET('/api/users/enrollments/courses/{courseId}/versions/{versionId}/ethics-consent', {
      params: { path: { courseId: 'c1', versionId: 'v1' } },
    });
    expect(calls[0].url).toBe('http://api.test/api/users/enrollments/courses/c1/versions/v1/ethics-consent');
    expect(calls[0].headers.get('Authorization')).toBe('Bearer tok-1');
    expect(res.data).toEqual({ signed: false });
  });

  it('retries once with a force-refreshed token after a 401', async () => {
    const calls = mockFetch(new Response('', { status: 401 }), new Response('{"ok":1}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const getToken = vi.fn(async (o?: { forceRefresh?: boolean }) => (o?.forceRefresh ? 'fresh' : 'stale'));
    const api = createApiClient({ baseUrl: 'http://api.test', getToken });
    const res = await api.GET('/api/users/me/face-reference', {});
    expect(getToken).toHaveBeenLastCalledWith({ forceRefresh: true });
    expect(calls.map((c) => c.headers.get('Authorization'))).toEqual(['Bearer stale', 'Bearer fresh']);
    expect(res.response.status).toBe(200);
  });

  it('turns an empty 200 body on a write into {} instead of a JSON parse error', async () => {
    mockFetch(new Response('', { status: 200 }));
    const api = createApiClient({ baseUrl: 'http://api.test', getToken: async () => null });
    const res = await api.PATCH('/api/users/edit', { body: { firstName: 'Asha' } });
    expect(res.error).toBeUndefined();
    expect(res.data).toEqual({});
  });

  it('sends no Authorization header when signed out', async () => {
    const calls = mockFetch(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const api = createApiClient({ baseUrl: 'http://api.test', getToken: async () => null });
    await api.GET('/api/users/me/face-reference', {});
    expect(calls[0].headers.has('Authorization')).toBe(false);
  });
});

describe('unwrap', () => {
  it('returns data on success and throws ApiError with the backend message otherwise', () => {
    expect(unwrap({ data: 1, response: new Response(null, { status: 200 }) })).toBe(1);
    expect(() => unwrap({ error: { message: 'Enrollment not found' }, response: new Response(null, { status: 404 }) })).toThrow(
      new ApiError(404, 'Enrollment not found', { message: 'Enrollment not found' }),
    );
  });
});
