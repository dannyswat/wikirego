import { Plugin } from "ckeditor5";

/**
 * A plugin that detects markdown content when pasting and converts it to HTML.
 * This allows users to paste markdown content directly into the CKEditor.
 */
export class MarkdownPaste extends Plugin {
  static get pluginName() {
    return "MarkdownPaste";
  }

  init() {
    const editor = this.editor;

    // Hook into the clipboard input processing pipeline with lower priority than SimplePasteCleanup
    this.listenTo(
      editor.plugins.get("ClipboardPipeline"),
      "inputTransformation",
      (_, data) => {
        if (data.dataTransfer) {
          // Get plain text - markdown is typically plain text
          const plainText = data.dataTransfer.getData("text/plain");
          const htmlData = data.dataTransfer.getData("text/html");

          // Only process if we have plain text and it looks like markdown
          // Skip if there's already meaningful HTML content (from copy within editor or from web)
          if (plainText && this.looksLikeMarkdown(plainText)) {
            // Check if HTML is just a simple wrapper around text (e.g., from plain text editors)
            const isSimpleHtml = !htmlData || this.isPlainTextHtml(htmlData);

            if (isSimpleHtml) {
              const convertedHtml = this.markdownToHtml(plainText);
              data.content = editor.data.processor.toView(convertedHtml);
            }
          }
        }
      },
      { priority: "high" }
    );
  }

  /**
   * Check if the HTML is just a simple wrapper around plain text
   */
  private isPlainTextHtml(html: string): boolean {
    // If HTML only contains basic tags that text editors add, treat it as plain text
    const stripped = html
      .replace(/<\/?(?:html|head|body|meta|pre|span|div|p)[^>]*>/gi, "")
      .replace(/<!--.*?-->/g, "")
      .trim();

    // If what's left is just text with no meaningful HTML, it's plain text
    const hasComplexHtml = /<(?!br)[a-z][^>]*>/i.test(stripped);
    return !hasComplexHtml;
  }

  /**
   * Detect if text content looks like markdown
   */
  private looksLikeMarkdown(text: string): boolean {
    const markdownPatterns = [
      /^#{1,6}\s+.+$/m, // Headers: # Header
      /^\s*[-*+]\s+.+$/m, // Unordered lists: - item or * item
      /^\s*\d+\.\s+.+$/m, // Ordered lists: 1. item
      /\*\*.+?\*\*/, // Bold: **text**
      /\*.+?\*/, // Italic: *text* (but not **)
      /__.+?__/, // Bold: __text__
      /_.+?_/, // Italic: _text_
      /~~.+?~~/, // Strikethrough: ~~text~~
      /`[^`]+`/, // Inline code: `code`
      /```[\s\S]*?```/, // Code blocks: ```code```
      /^\s*>\s+.+$/m, // Blockquotes: > quote
      /\[.+?\]\(.+?\)/, // Links: [text](url)
      /!\[.*?\]\(.+?\)/, // Images: ![alt](url)
      /^\s*[-*_]{3,}\s*$/m, // Horizontal rules: --- or *** or ___
      /\|.+\|.+\|/, // Tables: | col | col |
      /^\s*-\s*\[[ x]\]\s+/m, // Task lists: - [ ] or - [x]
    ];

    // Count how many markdown patterns match
    let matchCount = 0;
    for (const pattern of markdownPatterns) {
      if (pattern.test(text)) {
        matchCount++;
        // If we find at least 2 patterns, it's likely markdown
        if (matchCount >= 2) {
          return true;
        }
      }
    }

    // Single strong indicator patterns (these alone suggest markdown)
    const strongIndicators = [
      /^#{1,6}\s+.+$/m, // Headers are a strong indicator
      /```[\s\S]*?```/, // Code blocks are a strong indicator
      /^\s*>\s+.+$/m, // Blockquotes
      /\|.+\|.+\|/, // Tables
    ];

    for (const pattern of strongIndicators) {
      if (pattern.test(text)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Convert markdown to HTML
   */
  private markdownToHtml(markdown: string): string {
    let html = markdown;

    // Normalize line endings
    html = html.replace(/\r\n/g, "\n");

    // Escape HTML entities first (but we'll unescape some later for our conversions)
    html = this.escapeHtml(html);

    // Process code blocks first (before other transformations)
    html = this.processCodeBlocks(html);

    // Process inline code (must be before other inline formatting)
    html = this.processInlineCode(html);

    // Process headers
    html = this.processHeaders(html);

    // Process horizontal rules
    html = html.replace(/^\s*[-*_]{3,}\s*$/gm, "<hr>");

    // Process blockquotes
    html = this.processBlockquotes(html);

    // Process tables
    html = this.processTables(html);

    // Process lists
    html = this.processLists(html);

    // Process task lists (after regular lists)
    html = this.processTaskLists(html);

    // Process links and images
    html = this.processLinksAndImages(html);

    // Process inline formatting
    html = this.processInlineFormatting(html);

    // Process paragraphs (must be last)
    html = this.processParagraphs(html);

    return html;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  private processCodeBlocks(html: string): string {
    // Fenced code blocks with language
    html = html.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_, lang, code) => {
        const languageAttr = lang ? ` class="language-${lang}"` : "";
        return `<pre><code${languageAttr}>${code.trim()}</code></pre>`;
      }
    );

    // Indented code blocks (4 spaces or 1 tab)
    html = html.replace(
      /(?:^(?:\x20{4}|\t).+\n?)+/gm,
      (match) => {
        const code = match.replace(/^(?:\x20{4}|\t)/gm, "");
        return `<pre><code>${code.trim()}</code></pre>`;
      }
    );

    return html;
  }

  private processInlineCode(html: string): string {
    // Inline code with backticks
    return html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  }

  private processHeaders(html: string): string {
    // Process headers from h6 to h1 (to avoid partial matches)
    html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
    html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
    html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
    html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

    return html;
  }

  private processBlockquotes(html: string): string {
    // Process blockquotes
    const lines = html.split("\n");
    const result: string[] = [];
    let inBlockquote = false;
    let blockquoteContent: string[] = [];

    for (const line of lines) {
      const match = line.match(/^\s*&gt;\s?(.*)$/);
      if (match) {
        if (!inBlockquote) {
          inBlockquote = true;
          blockquoteContent = [];
        }
        blockquoteContent.push(match[1]);
      } else {
        if (inBlockquote) {
          result.push(`<blockquote><p>${blockquoteContent.join("<br>")}</p></blockquote>`);
          inBlockquote = false;
        }
        result.push(line);
      }
    }

    if (inBlockquote) {
      result.push(`<blockquote><p>${blockquoteContent.join("<br>")}</p></blockquote>`);
    }

    return result.join("\n");
  }

  private processTables(html: string): string {
    const lines = html.split("\n");
    const result: string[] = [];
    let inTable = false;
    let tableRows: string[] = [];
    let isHeaderRow = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isTableRow = /^\|.+\|$/.test(line.trim());
      const isSeparator = /^\|[-:\s|]+\|$/.test(line.trim());

      if (isTableRow && !isSeparator) {
        if (!inTable) {
          inTable = true;
          tableRows = [];
          isHeaderRow = true;
        }

        const cells = line
          .trim()
          .slice(1, -1)
          .split("|")
          .map((cell) => cell.trim());

        const cellTag = isHeaderRow ? "th" : "td";
        const row = `<tr>${cells.map((cell) => `<${cellTag}>${cell}</${cellTag}>`).join("")}</tr>`;
        tableRows.push(row);
      } else if (isSeparator && inTable) {
        // This is the separator row, mark that next rows are body rows
        isHeaderRow = false;
      } else {
        if (inTable) {
          // End of table
          const headerRows = tableRows.slice(0, 1).join("");
          const bodyRows = tableRows.slice(1).join("");
          result.push(
            `<table><thead>${headerRows}</thead><tbody>${bodyRows}</tbody></table>`
          );
          inTable = false;
        }
        result.push(line);
      }
    }

    if (inTable) {
      const headerRows = tableRows.slice(0, 1).join("");
      const bodyRows = tableRows.slice(1).join("");
      result.push(
        `<table><thead>${headerRows}</thead><tbody>${bodyRows}</tbody></table>`
      );
    }

    return result.join("\n");
  }

  private processLists(html: string): string {
    const lines = html.split("\n");
    const result: string[] = [];
    let inList = false;
    let listType: "ul" | "ol" = "ul";
    let listItems: string[] = [];

    for (const line of lines) {
      const unorderedMatch = line.match(/^\s*[-*+]\s+(.+)$/);
      const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);

      if (unorderedMatch) {
        if (!inList || listType !== "ul") {
          if (inList) {
            result.push(`<${listType}>${listItems.map((item) => `<li>${item}</li>`).join("")}</${listType}>`);
          }
          inList = true;
          listType = "ul";
          listItems = [];
        }
        listItems.push(unorderedMatch[1]);
      } else if (orderedMatch) {
        if (!inList || listType !== "ol") {
          if (inList) {
            result.push(`<${listType}>${listItems.map((item) => `<li>${item}</li>`).join("")}</${listType}>`);
          }
          inList = true;
          listType = "ol";
          listItems = [];
        }
        listItems.push(orderedMatch[1]);
      } else {
        if (inList) {
          result.push(`<${listType}>${listItems.map((item) => `<li>${item}</li>`).join("")}</${listType}>`);
          inList = false;
          listItems = [];
        }
        result.push(line);
      }
    }

    if (inList) {
      result.push(`<${listType}>${listItems.map((item) => `<li>${item}</li>`).join("")}</${listType}>`);
    }

    return result.join("\n");
  }

  private processTaskLists(html: string): string {
    // Convert task list items
    html = html.replace(
      /<li>\s*-\s*\[\s*\]\s+(.+?)<\/li>/gi,
      '<li><input type="checkbox" disabled> $1</li>'
    );
    html = html.replace(
      /<li>\s*-\s*\[x\]\s+(.+?)<\/li>/gi,
      '<li><input type="checkbox" checked disabled> $1</li>'
    );

    return html;
  }

  private processLinksAndImages(html: string): string {
    // Images: ![alt](url "title") or ![alt](url)
    html = html.replace(
      /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
      (_, alt, url, title) => {
        const titleAttr = title ? ` title="${title}"` : "";
        return `<img src="${url}" alt="${alt}"${titleAttr}>`;
      }
    );

    // Links: [text](url "title") or [text](url)
    html = html.replace(
      /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
      (_, text, url, title) => {
        const titleAttr = title ? ` title="${title}"` : "";
        return `<a href="${url}"${titleAttr}>${text}</a>`;
      }
    );

    return html;
  }

  private processInlineFormatting(html: string): string {
    // Bold: **text** or __text__
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");

    // Italic: *text* or _text_ (but not inside words for underscores)
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    html = html.replace(/(?<!\w)_([^_]+)_(?!\w)/g, "<em>$1</em>");

    // Strikethrough: ~~text~~
    html = html.replace(/~~([^~]+)~~/g, "<s>$1</s>");

    return html;
  }

  private processParagraphs(html: string): string {
    // Split by double newlines to identify paragraph breaks
    const blocks = html.split(/\n\n+/);

    return blocks
      .map((block) => {
        block = block.trim();
        if (!block) return "";

        // Don't wrap if it's already a block element
        if (
          /^<(?:h[1-6]|p|ul|ol|li|blockquote|pre|table|thead|tbody|tr|td|th|hr|div|figure|figcaption)/i.test(
            block
          )
        ) {
          return block;
        }

        // Convert single newlines to <br> within paragraphs
        block = block.replace(/\n/g, "<br>");

        return `<p>${block}</p>`;
      })
      .filter(Boolean)
      .join("\n");
  }
}
