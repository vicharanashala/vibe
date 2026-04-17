export const getCopyCourseName = (name: string): string => {
  const match = name.match(/\(Copy(?: (\d+))?\)$/i);

  if (match) {
    const currentNumber = match[1] ? parseInt(match[1], 10) : 1;
    const baseName = name.replace(/\(Copy(?: (\d+))?\)$/i, '').trim();
    return `${baseName} (Copy ${currentNumber + 1})`;
  }

  return `${name} (Copy)`;
};
