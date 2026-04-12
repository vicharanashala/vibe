// Helper function to convert buffer to hex string
interface BufferLike {
  buffer: {
    type: string;
    data: number[];
  };
}

export const bufferToHex = (item: string | BufferLike) => {
  if (typeof(item) === 'string') return item;
  return Array.from(new Uint8Array(item.buffer.data))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

// Helper function to get time-based greeting
export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};
