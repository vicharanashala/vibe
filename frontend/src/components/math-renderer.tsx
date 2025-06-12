import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  children: React.ReactNode;
  className?: string;
}

const MathRenderer: React.FC<MathRendererProps> = ({ children, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const renderMath = () => {
      const container = containerRef.current;
      if (!container) return;

      // Find all text nodes and process them for math expressions
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null
      );

      const textNodes: Text[] = [];
      let node;
      // eslint-disable-next-line no-cond-assign
      while (node = walker.nextNode()) {
        textNodes.push(node as Text);
      }

      textNodes.forEach(textNode => {
        const text = textNode.textContent || '';
        
        // Skip if already processed or in code blocks
        const parent = textNode.parentElement;
        if (!parent || parent.classList.contains('katex') || parent.tagName === 'CODE' || parent.tagName === 'PRE') {
          return;
        }

        // Process display math ($$...$$) - updated to handle multiline
        const displayMathRegex = /\$\$([\s\S]*?)\$\$/g;
        // Process inline math ($...$) - keep single line only
        const inlineMathRegex = /\$([^$\r\n]+)\$/g;

        let hasMatch = false;
        let newHTML = text;

        // Replace display math first (to avoid conflicts with inline math)
        newHTML = newHTML.replace(displayMathRegex, (match, mathContent) => {
          hasMatch = true;
          try {
            // Clean up the math content - normalize whitespace but preserve structure
            const cleanMath = mathContent.trim();
            const rendered = katex.renderToString(cleanMath, {
              displayMode: true,
              throwOnError: false,
              errorColor: '#cc0000',
              strict: false,
              trust: false,
              macros: {
                "\\f": "#1f(#2)",
                "\\RR": "\\mathbb{R}",
                "\\NN": "\\mathbb{N}",
                "\\ZZ": "\\mathbb{Z}",
                "\\QQ": "\\mathbb{Q}",
                "\\CC": "\\mathbb{C}"
              }
            });
            return `<div class="math-display" style="text-align: center; margin: 1em 0;">${rendered}</div>`;
          } catch (error) {
            console.warn('KaTeX rendering error for display math:', error);
            return `<span style="color: #cc0000; font-family: monospace;">${match}</span>`;
          }
        });

        // Replace inline math (after display math to avoid conflicts)
        newHTML = newHTML.replace(inlineMathRegex, (match, mathContent) => {
          hasMatch = true;
          try {
            const rendered = katex.renderToString(mathContent, {
              displayMode: false,
              throwOnError: false,
              errorColor: '#cc0000',
              strict: false,
              trust: false,
              macros: {
                "\\f": "#1f(#2)",
                "\\RR": "\\mathbb{R}",
                "\\NN": "\\mathbb{N}",
                "\\ZZ": "\\mathbb{Z}",
                "\\QQ": "\\mathbb{Q}",
                "\\CC": "\\mathbb{C}"
              }
            });
            return `<span class="math-inline">${rendered}</span>`;
          } catch (error) {
            console.warn('KaTeX rendering error for inline math:', error);
            return `<span style="color: #cc0000; font-family: monospace;">${match}</span>`;
          }
        });

        // If we found math expressions, replace the text node
        if (hasMatch && parent) {
          const wrapper = document.createElement('span');
          wrapper.innerHTML = newHTML;
          parent.replaceChild(wrapper, textNode);
        }
      });
    };

    // Initial render with longer delay to ensure content is loaded
    const timeoutId = setTimeout(renderMath, 300);

    // Set up mutation observer to handle dynamically added content
    const observer = new MutationObserver(() => {
      clearTimeout(timeoutId);
      setTimeout(renderMath, 300);
    });
    
    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
      characterData: true
    });

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [children]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
};

export default MathRenderer;
