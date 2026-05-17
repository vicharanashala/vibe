export const GURU_SETU_PILOT_COURSE_ID = '6981df886e100cfe04f9c4ad';
export const GURU_SETU_PILOT_VERSION_ID = '6981df886e100cfe04f9c4ae';

interface DownloadGuruSetuFeedbackParams {
  courseId: string;
  versionId: string;
  token: string;
  cohortId?: string | null;
}

export function isGuruSetuPilotCourse(
  courseId?: string,
  versionId?: string,
): boolean {
  return (
    courseId === GURU_SETU_PILOT_COURSE_ID &&
    versionId === GURU_SETU_PILOT_VERSION_ID
  );
}

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const escaped = raw.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';

  const headers: string[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }

  const csvLines = [headers.map(escapeCsvValue).join(',')];

  for (const row of rows) {
    const line = headers.map(header => escapeCsvValue(row[header])).join(',');
    csvLines.push(line);
  }

  return csvLines.join('\n');
}

function triggerCsvDownload(csv: string, fileName: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function downloadGuruSetuFeedbackExport({
  courseId,
  versionId,
  token,
  cohortId,
}: DownloadGuruSetuFeedbackParams): Promise<number> {
  const baseUrl = import.meta.env.VITE_BASE_URL;
  const query = cohortId ? `?cohortId=${encodeURIComponent(cohortId)}` : '';
  const url = `${baseUrl}/users/enrollments/courses/${courseId}/versions/${versionId}/export/gurusetu-feedback${query}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Failed to download Gurusetu feedback export');
  }

  const payload = await response.json();
  const rows: Record<string, unknown>[] = Array.isArray(payload?.data)
    ? payload.data
    : [];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '_');
  const fileName = cohortId
    ? `gurusetu_feedback_${cohortId}_${timestamp}.csv`
    : `gurusetu_feedback_${timestamp}.csv`;

  const csv = toCsv(rows);
  triggerCsvDownload(csv, fileName);

  return rows.length;
}
