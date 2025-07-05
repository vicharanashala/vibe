import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Utility function to preprocess content for math rendering
export function preprocessMathContent(content: string): string {
  if (!content) return content;

  let processedContent = content;

  // Ensure math expressions are properly formatted
  // Convert \( \) to $ $ for inline math
  processedContent = processedContent.replace(/\\\((.*?)\\\)/gs, '$$$1$$');
  // Convert \[ \] to $$ $$ for display math
  processedContent = processedContent.replace(/\\\[(.*?)\\\]/gs, '$$$$1$$$$');

  // Fix common LaTeX formatting issues
  // Ensure proper escaping for backslashes in math contexts
  processedContent = processedContent.replace(/\$\$(.*?)\$\$/gs, (_, mathContent) => {
    // Clean up the math content - remove extra escaping that might interfere
    const cleanMath = mathContent.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
    return `$$${cleanMath}$$`;
  });

  return processedContent;
};
