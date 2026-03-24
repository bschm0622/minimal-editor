import TurndownService from "turndown";

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
