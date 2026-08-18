/**
 * Moving a course between ViBe servers as a JSON bundle.
 *
 * Backed by the transfer endpoints:
 *   GET  /courses/:courseId/version/:versionId/export
 *   POST /courses/import
 *
 * These are not reached through the generated openapi client because the
 * checked-in schema predates them; they use the same raw-fetch pattern as the
 * other export downloads in the app.
 */

/**
 * Bundle format the client knows how to hand over. Kept in step with
 * BUNDLE_FORMAT_VERSION in the backend's CourseTransferValidators.
 */
export const BUNDLE_FORMAT_VERSION = 1;

export type CourseBundle = {
  formatVersion: number;
  exportedAt?: string;
  source?: {courseId?: string; courseVersionId?: string};
  course: {name: string; description?: string};
  version: {version: string; description?: string; supportLink?: string};
  modules: unknown[];
  questionBanks: unknown[];
  settings?: Record<string, unknown>;
};

export type ImportCourseResult = {
  courseId: string;
  versionId: string;
  name: string;
  message: string;
};

/** What the bundle deliberately leaves behind, shown before an import runs. */
export const BUNDLE_CARRIES = [
  'Course and version details',
  'Modules, sections and items in their original order',
  'Question banks and their questions',
  'Course settings (proctoring, seek-forward, linear progression)',
];

export const BUNDLE_OMITS = [
  'Enrollments, cohorts and invites',
  'Student progress, watch time and HP',
  'Announcements and ejection history',
  'Crowd-sourced student questions',
  'AI transcripts and segment context',
];

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('firebase-auth-token');
  return token ? {Authorization: `Bearer ${token}`} : {};
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (Array.isArray(body?.errors) && body.errors.length > 0) {
      const constraints = body.errors[0]?.constraints;
      const first = constraints ? Object.values(constraints)[0] : undefined;
      if (typeof first === 'string') return first;
    }
    if (typeof body?.message === 'string') return body.message;
  } catch {
    // Non-JSON body (a proxy timeout page, say) — fall through.
  }
  return fallback;
}

function slugify(value: string): string {
  return (
    (value || 'course')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'course'
  );
}

/**
 * Downloads a version as a .vibe.json bundle. Resolves to the file name written
 * so the caller can name it in a toast.
 */
export async function downloadCourseBundle(
  courseId: string,
  versionId: string,
): Promise<string> {
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const response = await fetch(
    `${baseUrl}/courses/${courseId}/version/${versionId}/export`,
    {
      method: 'GET',
      headers: {...authHeaders(), 'Content-Type': 'application/json'},
      credentials: 'include',
    },
  );

  if (!response.ok) {
    throw new Error(
      await errorMessage(response, 'Failed to export this course version'),
    );
  }

  const bundle = (await response.json()) as CourseBundle;
  const fileName = `${slugify(bundle?.course?.name)}-${slugify(
    bundle?.version?.version,
  )}.vibe.json`;

  const blob = new Blob([JSON.stringify(bundle)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return fileName;
}

/**
 * Reads a picked file and checks it is a bundle this client can send, so an
 * unreadable or wrong-format file fails locally rather than after a
 * multi-megabyte upload.
 */
export async function parseCourseBundle(file: File): Promise<CourseBundle> {
  let bundle: unknown;
  try {
    bundle = JSON.parse(await file.text());
  } catch {
    throw new Error('That file is not valid JSON. Pick a .vibe.json bundle.');
  }

  const candidate = bundle as Partial<CourseBundle>;
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    typeof candidate.formatVersion !== 'number' ||
    !candidate.course ||
    !candidate.version ||
    !Array.isArray(candidate.modules) ||
    !Array.isArray(candidate.questionBanks)
  ) {
    throw new Error(
      'That file is not a ViBe course bundle. Export one from a course version first.',
    );
  }

  if (candidate.formatVersion > BUNDLE_FORMAT_VERSION) {
    throw new Error(
      `This bundle uses format version ${candidate.formatVersion}, but this server understands version ${BUNDLE_FORMAT_VERSION}. Upgrade the server before importing.`,
    );
  }

  return candidate as CourseBundle;
}

/** Counts shown in the confirmation summary before the upload. */
export function summariseBundle(bundle: CourseBundle): {
  modules: number;
  sections: number;
  items: number;
  questionBanks: number;
  questions: number;
} {
  const modules = (bundle.modules ?? []) as any[];
  const sections = modules.flatMap(m => (m?.sections ?? []) as any[]);
  const items = sections.flatMap(s => (s?.items ?? []) as any[]);
  const banks = (bundle.questionBanks ?? []) as any[];

  return {
    modules: modules.length,
    sections: sections.length,
    items: items.length,
    questionBanks: banks.length,
    questions: banks.reduce((sum, b) => sum + (b?.questions?.length ?? 0), 0),
  };
}

export async function importCourseBundle(
  bundle: CourseBundle,
): Promise<ImportCourseResult> {
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const response = await fetch(`${baseUrl}/courses/import`, {
    method: 'POST',
    headers: {...authHeaders(), 'Content-Type': 'application/json'},
    credentials: 'include',
    body: JSON.stringify(bundle),
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Only administrators can import a course.');
    }
    throw new Error(await errorMessage(response, 'Failed to import the course'));
  }

  return (await response.json()) as ImportCourseResult;
}
