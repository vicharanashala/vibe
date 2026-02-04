import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
