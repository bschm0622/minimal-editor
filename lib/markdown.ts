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
