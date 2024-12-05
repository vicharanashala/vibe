import React from "react";
import katex from "katex"; // Import KaTeX for math rendering
import "katex/dist/katex.min.css"; // Import the CSS for styling
import { marked } from "marked"; // Import the Markdown parser

// Function to render math formulas using KaTeX
const renderMath = (math: string, displayMode: boolean = false) => {
  return katex.renderToString(math, {
    throwOnError: false,
    displayMode,
  });
};

// Function to process text, Markdown, and math
const processContent = (content: string): string => {
  // Step 1: Replace block math (e.g., $$...$$)
  const withBlockMath = content.replace(
    /\$\$(.*?)\$\$/gs,
    (_, math) => renderMath(math, true)
  );

  // Step 2: Replace inline math (e.g., $...$)
  const withInlineMath = withBlockMath.replace(
    /\$(.*?)\$/g,
    (_, math) => renderMath(math, false)
  );

  // Step 3: Parse the resulting text as Markdown to convert other syntax (e.g., headers, lists, etc.)
  const html = marked.parse(withInlineMath);

  return html;
};

const Testing = () => {
  const data = `
# Universal Renderer

This component can handle **plain text**, Markdown, and mathematical formulas.

### Plain Text:
This is an example of plain text being rendered as-is.

### Markdown Example:
1. **Bold Text**: Here's an example of bold text.
2. _Italic Text_: This text is italicized.
3. [Link Example](https://example.com)

### Image Example:
![Sample Image](https://i.pinimg.com/originals/24/12/bc/2412bc5c012e7360f602c13a92901055.jpg)

### Inline Math:
- Formula: $E = mc^2$

### Block Math:
$$
\\int_{a}^{b} f(x) dx = F(b) - F(a)
$$

### Mixed Content:
- Combine Markdown and math: $x^2 + y^2 = z^2$ within a list item.
`;

  // Process the content (handles text, Markdown, and math)
  const html = processContent(data);

  return (
    <div className="p-4 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold text-center mb-4">Renderer Demo</h1>
      <div
        className=""
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};
    
export default Testing;
