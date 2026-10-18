import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderApp } from '@/test/render-app';
import { api, fixtures, ok, resetSession } from '@/test/session';
import {
  FEEDBACK,
  hex,
  QUIZ_ITEM_ID,
  signInAdmin,
  studio,
  studioGet,
} from '@/test/studio';

vi.mock('@/lib/firebase', () =>
  import('@/test/session').then((m) => m.firebaseModule),
);
vi.mock('firebase/auth', async (orig) => ({
  ...(await orig<object>()),
  ...(await import('@/test/session')).firebaseAuthFns,
}));
vi.mock('@/lib/api', () => import('@/test/session').then((m) => m.apiModule));

/** The feedback fixture's section: "Short reading" (BLOG) then "Feedback". */
const loc = FEEDBACK;
const lessonUrl = (search: string) =>
  `/admin/courses/${loc.courseId}/${loc.versionId}/lesson?module=${loc.moduleId}&section=${loc.sectionId}&${search}`;
const READING_ID = studio.feedbackSectionItems[0]._id;

beforeEach(() => {
  resetSession();
  signInAdmin();
});

describe('lesson editor layout', () => {
  it('keeps the module outline on screen while the next lesson loads', async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    api.GET.mockImplementation(
      async (
        path: string,
        opts?: { params?: { path?: Record<string, string> } },
      ) => {
        if (
          path.endsWith('/item/{itemId}') &&
          opts?.params?.path?.itemId === READING_ID
        )
          await gate;
        return studioGet(path, opts);
      },
    );
    const { router } = renderApp(lessonUrl(`item=${loc.itemId}`));
    await screen
      .findByRole('heading', { name: /Questions|Feedback/ })
      .catch(() => undefined);
    await screen.findByLabelText('Title');

    await user.click(screen.getByRole('link', { name: 'Short reading' }));
    expect(await screen.findByLabelText('Loading lesson')).toBeInTheDocument();
    // The outline (and its highlight) is still there while the reading loads.
    expect(screen.getByRole('link', { name: 'Short reading' })).toHaveAttribute(
      'data-active',
    );
    expect(screen.getByRole('link', { name: 'Feedback' })).not.toHaveAttribute(
      'data-active',
    );
    expect(screen.getByRole('link', { name: 'Feedback' })).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ item: READING_ID });

    release();
    expect(
      await screen.findByRole('textbox', { name: 'Article body' }),
    ).toBeInTheDocument();
  });

  it('asks before leaving a lesson with unsaved changes', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(lessonUrl(`item=${loc.itemId}`));
    const title = await screen.findByLabelText('Title');
    await user.type(title, ' (edited)');
    await user.click(screen.getByRole('link', { name: 'Short reading' }));

    const dialog = await screen.findByRole('alertdialog', {
      name: 'Leave without saving?',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'Keep editing' }),
    );
    expect(router.state.location.search).toMatchObject({ item: loc.itemId });

    await user.click(screen.getByRole('link', { name: 'Short reading' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Discard changes',
      }),
    );
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ item: READING_ID }),
    );
  });
});

describe('article editor', () => {
  it('opens older Markdown lessons formatted, not as raw Markdown', async () => {
    // The captured reading, with a Markdown body like lessons written before the HTML editor.
    const markdown = {
      item: {
        ...fixtures.itemBlog.item,
        details: {
          ...fixtures.itemBlog.item.details,
          content: '## Why it matters\n\nArrays give **constant-time** reads.',
        },
      },
    };
    api.GET.mockImplementation(
      async (
        path: string,
        opts?: { params?: { path?: Record<string, string> } },
      ) =>
        path.endsWith('/item/{itemId}') &&
        opts?.params?.path?.itemId === READING_ID
          ? ok(markdown)
          : studioGet(path, opts),
    );
    renderApp(lessonUrl(`item=${READING_ID}`));
    const body = await screen.findByRole('textbox', { name: 'Article body' });
    expect(
      await within(body).findByRole('heading', { name: 'Why it matters' }),
    ).toBeInTheDocument();
    expect(within(body).getByText('constant-time').tagName).toBe('STRONG');
    expect(body.textContent).not.toContain('**');
  });

  it('saves the body as HTML and points as the decimal string the backend expects', async () => {
    const user = userEvent.setup();
    renderApp(lessonUrl(`item=${READING_ID}`));
    const title = await screen.findByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Renamed reading');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.PUT).toHaveBeenCalled());
    const [path, { body }] = api.PUT.mock.calls[0];
    expect(path).toBe(
      '/api/courses/{courseId}/versions/{versionId}/items/{itemId}',
    );
    expect(body).toMatchObject({ name: 'Renamed reading', type: 'BLOG' });
    expect(body.details.content).toMatch(/^<\w/);
    expect(typeof body.details.points).toBe('string');
    expect(body.details.points).toMatch(/^\d+\.\d$/);
  });
});

describe('video editor', () => {
  it('previews a YouTube link, checks the clip and publishes it', async () => {
    const user = userEvent.setup();
    api.POST.mockImplementation(async () =>
      ok({ createdItem: { _id: 'new-video' } }, 201),
    );
    renderApp(lessonUrl('type=VIDEO'));
    await user.type(
      await screen.findByLabelText('YouTube link'),
      'https://example.com/nope',
    );
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'doesn’t look like a YouTube link',
    );

    await user.clear(screen.getByLabelText('YouTube link'));
    await user.type(
      screen.getByLabelText('YouTube link'),
      'https://youtu.be/shs0KM3wKv8',
    );
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByTitle('Video preview').getAttribute('src')).toContain(
      '/embed/shs0KM3wKv8',
    );

    await user.clear(screen.getByLabelText('Start'));
    await user.type(screen.getByLabelText('Start'), '2:00');
    await user.type(screen.getByLabelText('End'), '1:00');
    expect(
      screen.getByText('The clip must end after it starts.'),
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText('End'));
    await user.type(screen.getByLabelText('End'), '4:30');
    await user.type(screen.getByLabelText('Title'), 'Hash tables');
    await user.type(screen.getByLabelText('Subtitle'), 'A short walk-through');
    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith(
        '/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items',
        {
          params: {
            path: {
              versionId: loc.versionId,
              moduleId: loc.moduleId,
              sectionId: loc.sectionId,
            },
          },
          body: expect.objectContaining({
            type: 'VIDEO',
            name: 'Hash tables',
            videoDetails: expect.objectContaining({
              URL: 'https://youtu.be/shs0KM3wKv8',
              startTime: '2:00',
              endTime: '4:30',
              source: 'YOUTUBE',
            }),
          }),
        },
      ),
    );
  });
});

describe('quiz editor', () => {
  const quizUrl = lessonUrl(`item=${QUIZ_ITEM_ID}`);

  it('loads the quiz’s questions from its bank, keeping formatting', async () => {
    renderApp(quizUrl);
    expect(await screen.findByLabelText('Question 1 text')).toBeInTheDocument();
    expect(screen.getByLabelText('Question 3 text')).toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Question 1 text')).getByText('average')
        .tagName,
    ).toBe('STRONG');
    expect(
      screen.getByRole('radio', { name: 'Option 1 is correct' }),
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('only touches questions that changed, and removes deleted ones from the bank', async () => {
    const user = userEvent.setup();
    renderApp(quizUrl);
    await screen.findByLabelText('Question 2 text');
    await user.click(
      screen.getByRole('button', { name: 'Question 2: actions' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: /delete/i }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(api.PATCH).toHaveBeenCalledWith(
        '/api/quizzes/question-bank/{questionBankId}/questions/{questionId}/remove',
        expect.anything(),
      ),
    );
    const removed = api.PATCH.mock.calls.find((c) =>
      String(c[0]).endsWith('/remove'),
    )![1].params.path.questionId;
    const numeric = studio.quizQuestions.find(
      (q) => q.type === 'NUMERIC_ANSWER_TYPE',
    )!;
    expect(removed).toBe(hex(numeric._id));
    // Unchanged questions are not re-saved.
    expect(
      api.PUT.mock.calls.filter(
        (c) => c[0] === '/api/quizzes/questions/{questionId}',
      ),
    ).toHaveLength(0);
    // The item update carries the bank links back, since it replaces details.
    const itemPut = api.PUT.mock.calls.find(
      (c) =>
        c[0] === '/api/courses/{courseId}/versions/{versionId}/items/{itemId}',
    )!;
    expect(itemPut[1].body.details.questionBankRefs).toEqual(
      studio.quizItem.item.details.questionBankRefs,
    );
  });
});

describe('feedback editor', () => {
  it('shows saved questions as previews and saves edits in the shared schema format', async () => {
    const user = userEvent.setup();
    renderApp(lessonUrl(`item=${loc.itemId}`));
    expect(await screen.findAllByRole('button', { name: 'Edit' })).toHaveLength(
      3,
    );
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[1]);
    const label = screen.getByDisplayValue('What could make it better?');
    await user.clear(label);
    await user.type(label, 'What should change?');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.PUT).toHaveBeenCalled());
    const { body } = api.PUT.mock.calls[0][1];
    expect(body.type).toBe('FEEDBACK');
    expect(Object.keys(body.details.jsonSchema.properties)).toEqual([
      'How useful was the previous lesson?',
      'What should change?',
      'Which part was hardest?',
    ]);
    expect(body.details.uiSchema['ui:order']).toEqual([
      'How useful was the previous lesson?',
      'What should change?',
      'Which part was hardest?',
    ]);
    expect(
      body.details.uiSchema['How useful was the previous lesson?'][
        'ui:options'
      ],
    ).toMatchObject({ display: 'rating' });
  });

  it('starts new forms from a template and warns when they can’t collect answers', async () => {
    const user = userEvent.setup();
    api.POST.mockImplementation(async () =>
      ok({ createdItem: { _id: 'new-form' } }, 201),
    );
    const { router } = renderApp(lessonUrl('type=FEEDBACK'));
    // Appended after the existing feedback form, which the backend doesn't allow.
    expect(
      await screen.findByText('Students can’t submit this form where it is'),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('How useful was the previous lesson?'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith(
        '/api/courses/versions/{versionId}/modules/{moduleId}/sections/{sectionId}/items',
        expect.objectContaining({
          body: expect.objectContaining({
            type: 'FEEDBACK',
            feedbackFormDetails: expect.objectContaining({
              jsonSchema: expect.any(Object),
            }),
          }),
        }),
      ),
    );
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ item: 'new-form' }),
    );
  });

  it('summarises responses: rating average and choice counts', async () => {
    const user = userEvent.setup();
    renderApp(lessonUrl(`item=${loc.itemId}`));
    await user.click(await screen.findByRole('tab', { name: 'Responses' }));
    const submissions = studio.feedbackSubmissions.submissions;
    const ratings = submissions.map((s) =>
      Number(s.details['How useful was the previous lesson?']),
    );
    const avg = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(
      1,
    );
    expect(await screen.findByText(avg)).toBeInTheDocument();
    expect(screen.getByText('average out of 5')).toBeInTheDocument();
    expect(screen.getByText('More diagrams please.')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Individual/ }));
    expect(
      await screen.findAllByText(submissions[0].user.email!),
    ).not.toHaveLength(0);
  });
});

// Keep the shared fixture import referenced for readers: the reading lesson falls back to it.
void fixtures;
