// Helper function to extract JSON from markdown code blocks
function extractJSONFromMarkdown(text: string): string {
  // Remove markdown code block markers
  let cleanText = text.trim();

  // Check if it starts with ```json and ends with ```
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.substring(7); // Remove '```json'
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.substring(3); // Remove '```'
  }

  if (cleanText.endsWith('```')) {
    cleanText = cleanText.substring(0, cleanText.length - 3); // Remove trailing '```'
  }

  return cleanText.trim();
}

export {extractJSONFromMarkdown};
