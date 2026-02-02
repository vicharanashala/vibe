const mediaRegister = new Map<string, MediaStream>();

export function registerStream(id: string, stream: MediaStream) {
  mediaRegister.set(id, stream);
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
