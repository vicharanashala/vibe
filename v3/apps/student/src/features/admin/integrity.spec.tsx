import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, resetSession } from '@/test/session';
import { FEEDBACK, hex, signInAdmin, studio } from '@/test/studio';

vi.mock('@/lib/firebase', () =>
  import('@/test/session').then((m) => m.firebaseModule),
);
vi.mock('firebase/auth', async (orig) => ({
  ...(await orig<object>()),
  ...(await import('@/test/session')).firebaseAuthFns,
}));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

const url = `/admin/courses/${FEEDBACK.courseId}/${FEEDBACK.versionId}?tab=proctoring`;
const noFace = studio.integrity.incidents.data.find(
  (i) => i.type === 'NO_FACE',
)!;
const studentId = hex(noFace.userId);
const REMOVE =
  '/api/ejections/courses/{courseId}/versions/{courseVersionId}/users/{userId}';
const REINSTATE =
  '/api/reinstatements/courses/{courseId}/versions/{courseVersionId}/users/{userId}';
const path = {
  courseId: FEEDBACK.courseId,
  courseVersionId: FEEDBACK.versionId,
  userId: studentId,
};

/** Serve `data` for one GET path, everything else as usual. */
function serve(target: string, data: unknown) {
  const base = api.GET.getMockImplementation()!;
  api.GET.mockImplementation(async (p: string, opts: never) =>
    p === target
      ? { data, error: undefined, response: new Response() }
      : base(p, opts),
  );
}

beforeEach(() => {
  resetSession();
  signInAdmin();
});

describe('proctoring incidents', () => {
  it('sums up what the checks caught', async () => {
    renderApp(url);
    const byType = await screen.findByRole('list', {
      name: 'Incidents by type',
    });
    expect(within(byType).getByLabelText('No face: 1')).toBeInTheDocument();
    expect(
      within(byType).getByLabelText('Several faces: 1'),
    ).toBeInTheDocument();
    // Tied types don't name a "most common" one.
    expect(screen.getByText('No single type')).toBeInTheDocument();
  });

  it('groups incidents by student, and removes a student with an editable reason', async () => {
    const user = userEvent.setup();
    renderApp(url);
    await user.click(
      await screen.findByRole('button', { name: /Asha Student/ }),
    );
    const sheet = await screen.findByRole('dialog', { name: 'Asha Student' });
    expect(
      within(
        within(sheet).getByRole('list', { name: 'Incidents, newest first' }),
      ).getAllByRole('button'),
    ).toHaveLength(2);

    await user.click(
      within(sheet).getByRole('button', { name: /Remove from course/ }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: /Remove Asha Student/,
    });
    const reason = within(dialog).getByLabelText('Reason');
    // Ties keep the incident list's (newest-first) order.
    expect(reason).toHaveValue(
      'Repeated proctoring incidents: several faces (1), no face (1).',
    );
    await user.clear(reason);
    await user.type(reason, 'Camera kept off');
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith(REMOVE, {
        params: { path },
        body: { reason: 'Camera kept off' },
      }),
    );
  });

  it('dismisses a false alarm after confirming', async () => {
    const user = userEvent.setup();
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: 'All incidents' }));
    await user.click(
      await screen.findByRole('button', {
        name: /^No face, Asha Student, .*: view$/,
      }),
    );
    const sheet = await screen.findByRole('dialog');
    expect(
      within(sheet).getByText('No photo was saved with this incident.'),
    ).toBeInTheDocument();
    await user.click(
      within(sheet).getByRole('button', { name: /Dismiss as false alarm/ }),
    );
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Dismiss',
      }),
    );
    await waitFor(() =>
      expect(api.DELETE).toHaveBeenCalledWith('/api/anomalies/{id}', {
        params: { path: { id: hex(noFace._id) } },
        body: { courseId: FEEDBACK.courseId, versionId: FEEDBACK.versionId },
      }),
    );
  });
});

describe('removed students', () => {
  it('shows nobody once a removed student was reinstated', async () => {
    const user = userEvent.setup();
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: 'Removed' }));
    expect(await screen.findByText('No one is removed')).toBeInTheDocument();
  });

  it('reinstates a removed student', async () => {
    const user = userEvent.setup();
    const { history } = studio.integrity.history;
    serve('/api/ejections/history', {
      history: history.filter((h) => h.type === 'EJECTED'),
      totalDocuments: 1,
      totalPages: 1,
    });
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: 'Removed' }));
    expect(
      await screen.findByText('Test: repeated no-face incidents'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Removed by Ira Instructor/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reinstate' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Reinstate',
      }),
    );
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith(REINSTATE, {
        params: { path },
        body: {},
      }),
    );
  });
});

describe('appeals', () => {
  // No appeal can be made locally (the backend needs cohorts), so this one is
  // built from the shape AppealService.getAppeals returns.
  const appeal = {
    _id: 'a1',
    status: 'PENDING',
    reason: 'My camera was blocked by the lid.',
    createdAt: '2026-10-18T11:00:00.000Z',
    evidenceImages: [],
    student: {
      id: studentId,
      firstName: 'Asha',
      lastName: 'Student',
      email: 'student@vibe.local',
    },
  };

  it('shows the waiting count and rejects with a reason', async () => {
    const user = userEvent.setup();
    serve('/api/appeals/', [appeal]);
    renderApp(url);
    const tab = await screen.findByRole('tab', { name: /Appeals/ });
    await waitFor(() => expect(tab).toHaveTextContent('1'));
    await user.click(tab);
    expect(await screen.findByText(appeal.reason)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Reject this appeal?',
    });
    await user.type(
      within(dialog).getByLabelText('Reason'),
      'Camera was off for 20 minutes.',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Reject appeal' }),
    );
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith('/api/appeals/{id}/reject', {
        params: { path: { id: 'a1' } },
        body: { reason: 'Camera was off for 20 minutes.' },
      }),
    );
  });

  it('says when nothing is waiting', async () => {
    const user = userEvent.setup();
    renderApp(url);
    await user.click(await screen.findByRole('tab', { name: /Appeals/ }));
    expect(await screen.findByText('No appeals waiting')).toBeInTheDocument();
  });
});
