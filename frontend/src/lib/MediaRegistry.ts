const mediaRegister = new Map<string, MediaStream>();

export function registerStream(id: string, stream: MediaStream) {
  mediaRegister.set(id, stream);
}

export function getStream(id: string): MediaStream | undefined {
  return mediaRegister.get(id);
}

export function unRegisterStream(id: string) {
  mediaRegister.get(id)?.getTracks().forEach(t => t.stop());
  mediaRegister.delete(id);
}

export function stopAllStreams() {
  for(const id of mediaRegister.keys()) {
    mediaRegister.get(id)?.getTracks().forEach(t => t.stop());
    mediaRegister.delete(id);
  }
  mediaRegister.clear();
}

// Polls briefly for a stream a sibling/parent component is about to
// register (e.g. course-page.tsx's mount effect acquires one for its own
// spoof check). Child effects commit before a parent's on mount, so a
// consumer mounted inside that parent can genuinely run before the stream
// exists yet -- a short poll covers that race without a bigger restructure.
export async function waitForStream(key: string, timeoutMs = 2000, intervalMs = 50): Promise<MediaStream | undefined> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const stream = getStream(key);
    if (stream) return stream;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return getStream(key);
}
