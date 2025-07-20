export async function updateProctoringSettings(
  courseId: string,
  courseVersionId: string,
  detectors: { name: string; enabled: boolean }[],
  isNew: boolean
) {
  const method = 'PUT';
  const url = `${import.meta.env.VITE_BASE_URL}/setting/course-setting/${courseId}/${courseVersionId}/proctoring`;

  const body =
  {
    detectors: detectors.map((d) => ({
      detectorName: d.name,
      settings: { enabled: d.enabled },
    })),
  };

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'authorization': `Bearer ${localStorage.getItem('firebase-auth-token')}` },
    body: JSON.stringify(body),
  });

  // console.log('Proctoring settings response:', res);

  if (!res.ok) {
    throw new Error(`Failed to update settings: ${res.status}`);
  }

  return await res.json();
}

export async function getProctoringSettings(
  courseId: string,
  courseVersionId: string
) {
  const method = 'GET';
  const url = `${import.meta.env.VITE_BASE_URL}/setting/course-setting/${courseId}/${courseVersionId}/`;

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'authorization': `Bearer ${localStorage.getItem('firebase-auth-token')}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to update settings: ${res.status}`);
  }

  return await res.json();
}