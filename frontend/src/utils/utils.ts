import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a days-to-complete value (may be fractional) into a human label.
 * Sub-day completions render as hours so finishers never show a bare "0 days".
 *   compact=false → "3 days" | "5 hours" | "under 1 hour"
 *   compact=true  → "3d" | "5h" | "<1h"
 */
export function formatCompletionTime(
  days: number | null | undefined,
  compact = false
): string {
  if (days == null) return compact ? "✓" : "Completed";
  if (days >= 1) {
    const d = days % 1 === 0 ? days : Math.round(days * 10) / 10;
    return compact ? `${d}d` : `${d} ${d === 1 ? "day" : "days"}`;
  }
  const hours = Math.round(days * 24);
  if (hours < 1) return compact ? "<1h" : "under 1 hour";
  return compact ? `${hours}h` : `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

// Utility function to preprocess content for math rendering
// export function preprocessMathContent(content: string): string {
//   if (!content) return content;

//   let processedContent = content;

//   // Ensure math expressions are properly formatted
//   // Convert \( \) to $ $ for inline math
//   processedContent = processedContent.replace(/\\\((.*?)\\\)/gs, '$$$1$$');
//   // Convert \[ \] to $$ $$ for display math
//   processedContent = processedContent.replace(/\\\[(.*?)\\\]/gs, '$$$$1$$$$');

//   // Fix common LaTeX formatting issues
//   // Ensure proper escaping for backslashes in math contexts
//   processedContent = processedContent.replace(/\$\$(.*?)\$\$/gs, (_, mathContent) => {
//     // Clean up the math content - remove extra escaping that might interfere
//     const cleanMath = mathContent.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
//     return `$$${cleanMath}$$`;
//   });

//   return processedContent;
// };

export function preprocessMathContent(content: string): string {
  if (!content) return content;

  let processedContent = content;

  processedContent = processedContent.replace(/\\\((.*?)\\\)/gs, '$$$1$$');
  processedContent = processedContent.replace(/\\\[(.*?)\\\]/gs, '$$$$1$$$$');

  // Preserve new lines inside $$ $$ math blocks
  processedContent = processedContent.replace(/\$\$(.*?)\$\$/gs, (_, mathContent) => {
    const cleanMath = mathContent.replace(/\\n/g, '\n'); 
    return `$$${cleanMath}$$`;
  });

  return processedContent;
}

export function preprocessRemoveFromOptions(content: string): string {
  if (!content) return content;

  // Remove ABCD options from the content
  const optionRegex = /[A-Z]\)\s*/g;
  return content.replace(optionRegex, '');
}

export const formatDateTime = (dateString: string, asString = false) => {
  const date = new Date(dateString)
  const formatted = {
    date: date.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short", // e.g. Sep
      day: "2-digit", // 06
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };

  return asString ? `${formatted.date} ${formatted.time}` : formatted;
}
export const buildEmptyFormData = (schema: any) => {
  if (!schema?.properties) return {};

  const obj: Record<string, any> = {};
  Object.keys(schema.properties).forEach((key) => {
    obj[key] = undefined; //  stops enum auto select
  });

  return obj;
};

export const normalizeSchemaOptions = (schema: any): any => {
  if (!schema || typeof schema !== "object") return schema;

  const clone = { ...schema };

  const toTitle = (str: string) =>
    str
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());

  if (clone.properties) {
    clone.properties = Object.fromEntries(
      Object.entries(clone.properties).map(([key, value]: any) => {
        let prop = { ...value };

        //  oneOf + enum >>> remove enum
        if (prop.oneOf && prop.enum) {
          delete prop.enum;
        }

        // only enum >>> convert to oneOf
        if (!prop.oneOf && prop.enum) {
          prop.oneOf = prop.enum.map((val: string) => ({
            const: val,
            title: toTitle(val),
          }));
          delete prop.enum;
        }

        return [key, normalizeSchemaOptions(prop)];
      })
    );
  }

  return clone;
};
