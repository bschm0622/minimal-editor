import { ALT_KEY } from "./utils";

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Saved HTML for an alternative showing version `active`. */
function alternative(id: string, versions: string[], active: number) {
  const data = escapeHtml(
    JSON.stringify({
      active,
      variants: versions.map((text) => (text ? [{ type: "text", text }] : [])),
      ai: versions.map(() => false),
    })
  );
  return versions[active]
    ? `<span data-alternative="${id}" data-alternatives="${data}">${escapeHtml(versions[active])}</span>`
    : `<span data-alternative-gap="${id}" data-alternatives="${data}"></span>`;
}

/** The doc a first visit opens on, with one alternative and one dimmed sentence to try. */
export function welcomeHtml() {
  return [
    "<h1>Welcome to Minimal Editor</h1>",
    "<p>Everything you write here saves in this browser as you type. There's no account and nothing to open or save.</p>",
    `<p>Text with a dotted underline has other versions. ${alternative(
      "alt-welcome1",
      [
        "This sentence is one of them.",
        "This sentence has a few versions.",
        "You're reading another version of this sentence.",
      ],
      0
    )} Click into it and press ${ALT_KEY}↓ to switch versions, or ${ALT_KEY}↵ to see them all.</p>`,
    `<p>Faint text is a cut you haven't committed to. ${alternative(
      "alt-welcome2",
      ["This sentence could go. ", ""],
      1
    )}Click it and press ${ALT_KEY}D to bring it back.</p>`,
    `<p>To try it on your own words, select some text and press ${ALT_KEY}↵ to write another version, or ${ALT_KEY}D to dim it.</p>`,
    `<p>Press ${ALT_KEY}N for a new doc, or delete all of this and start writing. The ? at the top right lists every shortcut.</p>`,
  ].join("");
}
