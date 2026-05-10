import { http, HttpResponse, type HttpHandler } from 'msw';

const API_BASE = '/api';

/**
 * Default MSW handlers — minimal happy-path stubs covering the broad surface
 * of the OpenAPI schema. Per-test overrides via `mockEndpoint(...)` from
 * handlers.factory.ts. Expand this list as integration tests demand more
 * realistic responses.
 */
export const defaultHandlers: HttpHandler[] = [
  http.get(`${API_BASE}/health`, () => HttpResponse.json({ ok: true })),

  // Auth
  http.post(`${API_BASE}/auth/signin`, () =>
    HttpResponse.json({ token: 'mock-token', user: { id: 'u-1', email: 'test@vibe.local', roles: ['student'] } })
  ),
  http.post(`${API_BASE}/auth/signup`, () =>
    HttpResponse.json({ id: 'u-1', email: 'test@vibe.local' }, { status: 201 })
  ),
  http.post(`${API_BASE}/auth/signout`, () => HttpResponse.json({ ok: true })),

  // Users / current
  http.get(`${API_BASE}/users/me`, () =>
    HttpResponse.json({ id: 'u-1', email: 'test@vibe.local', firstName: 'Test', lastName: 'User', roles: ['student'] })
  ),

  // Courses
  http.get(`${API_BASE}/courses`, () => HttpResponse.json({ items: [], total: 0 })),
  http.get(`${API_BASE}/courses/:id`, ({ params }) =>
    HttpResponse.json({ id: params.id, name: 'Test Course', description: 'mocked' })
  ),

  // Enrollments
  http.get(`${API_BASE}/enrollments`, () => HttpResponse.json({ items: [] })),

  // Progress
  http.get(`${API_BASE}/progress/:userId/:itemId`, () => HttpResponse.json({ watchedPct: 0, completed: false })),
  http.post(`${API_BASE}/progress/start`, () => HttpResponse.json({ ok: true })),
  http.post(`${API_BASE}/progress/stop`, () => HttpResponse.json({ ok: true })),
  http.post(`${API_BASE}/progress/update`, () => HttpResponse.json({ ok: true })),

  // Quizzes
  http.get(`${API_BASE}/quizzes/:id`, ({ params }) =>
    HttpResponse.json({ id: params.id, questions: [], totalPoints: 10 })
  ),
  http.post(`${API_BASE}/quizzes/:id/attempts`, () => HttpResponse.json({ id: 'a-1', status: 'started' })),
];
