export async function updateProctoringSettings(
  courseId: string,
  courseVersionId: string,
  detectors: { name: string; enabled: boolean }[],
  isNew: boolean
) {
  const method = isNew ? 'POST' : 'PUT';
  const url = isNew
    ? '/api/settings/courses'
    : `/api/settings/courses/${courseId}/${courseVersionId}/proctoring`;

  const body = isNew
    ? {
      courseId,
      courseVersionId,
      detectors: detectors.map((d) => ({
        detectorName: d.name,
        settings: { enabled: d.enabled },
      })),
    }
    : {
      detectors: detectors.map((d) => ({
        detectorName: d.name,
        settings: { enabled: d.enabled },
      })),
    };

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Failed to update settings: ${res.status}`);
  }

  return await res.json();
}