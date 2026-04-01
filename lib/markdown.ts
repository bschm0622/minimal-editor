import MarkdownIt from "markdown-it";
import markdownItTaskLists from "markdown-it-task-lists";
import TurndownService from "turndown";
import {
  highlightedCodeBlock,
  strikethrough,
  taskListItems,
} from "turndown-plugin-gfm";

const markdown = new MarkdownIt({
  breaks: true,
  html: false,
  linkify: true,
}).use(markdownItTaskLists, {
  enabled: true,
  label: true,
  labelAfter: true,
});

const turndown = new TurndownService({
  headingStyle: "atx",
  hr: "---",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  strongDelimiter: "**",
});

turndown.use([highlightedCodeBlock, strikethrough, taskListItems]);

function escapeMarkdownTableCell(content: string) {
  return content
    .replace(/\n+/g, "<br>")
    .replace(/\|/g, "\\|")
    .trim();
}

function getElementIndex(node: Node) {
  if (!(node.parentNode instanceof Element)) {
    return 0;
  }

  return Array.from(node.parentNode.children).indexOf(node as Element);
}

function isHeaderRow(node: Node) {
  if (!(node instanceof HTMLTableRowElement)) {
    return false;
  }

  const parent = node.parentElement;

  if (!parent) {
    return false;
  }

  if (parent.tagName === "THEAD") {
    return true;
  }

  const firstRow = parent.querySelector("tr");
  return firstRow === node;
}

function getDividerCell(node: Element) {
  const align = (node.getAttribute("align") || "").toLowerCase();

  if (align === "left") return ":---";
  if (align === "center") return ":---:";
  if (align === "right") return "---:";

  return "---";
}

turndown.addRule("tableCell", {
  filter: ["th", "td"],
  replacement(content, node) {
    const index = getElementIndex(node);
    const value = escapeMarkdownTableCell(content);

    return `${index === 0 ? "| " : " "}${value} |`;
  },
});

turndown.addRule("tableRow", {
  filter: "tr",
  replacement(content, node) {
    if (!(node instanceof HTMLTableRowElement)) {
      return `\n${content}`;
    }

    const divider = isHeaderRow(node)
      ? `\n| ${Array.from(node.cells)
          .map((cell) => getDividerCell(cell))
          .join(" | ")} |`
      : "";

    return `\n${content}${divider}`;
  },
});

turndown.addRule("tableSection", {
  filter: ["thead", "tbody", "tfoot"],
  replacement(content) {
    return content;
  },
});

turndown.addRule("table", {
  filter: "table",
  replacement(content) {
    return `\n\n${content.replace(/\n{3,}/g, "\n\n").trim()}\n\n`;
  },
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

export function tabularTextToHtml(source: string): string | null {
  const rows = source
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split("\t").map((cell) => cell.trim()));

  if (rows.length === 0 || rows[0]?.length < 2) {
    return null;
  }

  const columnCount = rows[0].length;

  if (rows.some((row) => row.length !== columnCount)) {
    return null;
  }

  const body = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => `<td>${escapeHtml(cell)}</td>`)
          .join("")}</tr>`
    )
    .join("");

  return `<table><tbody>${body}</tbody></table>`;
}

export function htmlToMarkdown(html: string): string {
  return turndown
    .turndown(html)
    .replace(/^[-*+]\s+\[( |x)\]\s+/gim, (_match, checked) => `- [${checked}] `);
}

export function markdownToHtml(source: string): string {
  return markdown.render(source);
}

export function normalizeMarkdownPaste(source: string): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let inFence = false;
  let minIndent = Number.POSITIVE_INFINITY;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      inFence = !inFence;
    }

    if (inFence || trimmed === "") {
      continue;
    }

    const match = line.match(/^[ \t]+/);
    const indent = match?.[0].length ?? 0;
    minIndent = Math.min(minIndent, indent);
  }

  if (!Number.isFinite(minIndent) || minIndent === 0) {
    return source.trimEnd();
  }

  return lines
    .map((line) => {
      if (line.trim() === "") {
        return "";
      }

      return line.replace(new RegExp(`^[ \\t]{0,${minIndent}}`), "");
    })
    .join("\n")
    .trimEnd();
}

export function looksLikeMarkdown(source: string): boolean {
  const text = source.trim();
  if (!text) return false;

  return [
    /^#{1,6}\s/m,
    /^>\s/m,
    /^[-*+]\s/m,
    /^[-*+]\s\[(?: |x|X)\]\s/m,
    /^\d+\.\s/m,
    /```/,
    /`[^`]+`/,
    /\[.+?\]\(.+?\)/,
    /(^|\s)(\*\*|__)[^\n]+(\*\*|__)(?=\s|$)/,
    /(^|\s)(\*|_)[^\n]+(\*|_)(?=\s|$)/,
    /^---$/m,
    /^\|.+\|$/m,
  ].some((pattern) => pattern.test(text));
}
