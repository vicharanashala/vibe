// Helper function to convert buffer to hex string
export const bufferToHex = (buffer: unknown): string => {
  if (buffer && typeof buffer === 'object' && 'buffer' in buffer) {
    const bufferObj = buffer as { buffer?: { data: number[] } };
    if (bufferObj.buffer?.data) {
      return Array.from(new Uint8Array(bufferObj.buffer.data))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  }
  return '';
};

// Helper function to get time-based greeting
export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};
