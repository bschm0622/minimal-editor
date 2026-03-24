import MarkdownIt from "markdown-it";
import TurndownService from "turndown";

const markdown = new MarkdownIt({
  breaks: true,
  html: false,
  linkify: true,
});

const turndown = new TurndownService({
  headingStyle: "atx",
  hr: "---",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  strongDelimiter: "**",
});

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
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
    /^\d+\.\s/m,
    /```/,
    /`[^`]+`/,
    /\[.+?\]\(.+?\)/,
    /(^|\s)(\*\*|__)[^\n]+(\*\*|__)(?=\s|$)/,
    /(^|\s)(\*|_)[^\n]+(\*|_)(?=\s|$)/,
    /^---$/m,
  ].some((pattern) => pattern.test(text));
}
