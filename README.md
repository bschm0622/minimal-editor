# Minimal Editor

A deliberately simple writing app built with Next.js, Tiptap, and Tailwind.

Docs live in the browser. There are no files to open or save: every doc
autosaves locally as you type, and you can keep several docs open as tabs.

## Features

- Clean rich-text writing surface with Markdown-friendly shortcuts
- Multiple docs as tabs, each named after its first line
- Per-doc undo history and scroll position
- Slash menu for common block types
- Paste Markdown directly into the editor
- Copy a doc (or a selection) as Markdown
- Word count
- Focus mode
- Font switching: Clean (Figtree), Warm (Bitter), Editorial (Source Serif 4), Code (Geist Mono)
- Light and dark mode
- Alternatives: several versions of a word, sentence, or paragraph, to switch between and keep one

## Shortcuts

- `/` opens the block menu
- `# `, `## `, `### ` create headings
- `Cmd/Ctrl + K` adds a link
- `Cmd/Ctrl + Shift + C` copies the doc as Markdown
- `Alt + N` new doc
- `Alt + W` close doc (an Undo toast appears for a few seconds)
- `Alt + [` / `Alt + ]` previous / next doc
- `Alt + 1–9` jump to a doc (`9` is the last one)
- `Alt + ↑` / `Alt + ↓` switch between alternatives (cursor in the text)
- `Alt + Enter` show or hide an alternative's versions

## Alternatives

Text with a dotted underline has other versions: grey while the original is on
screen, blue while another version is. Put the cursor in it and press
`Alt + ↑ / ↓` to switch versions in place.

`Alt + Enter` opens a side panel with the versions as a list (top line is the
original, a robot marks AI suggestions). Type straight into a line to rewrite
it; `Enter` adds a version, `↑ / ↓` moves between them, `Backspace` on an empty
line deletes it, `Cmd/Ctrl + Enter` keeps that version, and `Esc` or
`Alt + Enter` goes back to the text. With the cursor outside any alternative,
the panel lists them all.

To add one yourself, select text and use the bubble: the layers button adds an
alternative, the eye button dims the text. Dimmed text is a version that
removes it: it stays faintly visible but isn't part of the doc (word count,
copy, Markdown).

Alternatives sit inside one paragraph and are saved with the doc. Copying text
copies what's on screen; copying or moving a whole alternative keeps its
versions.

### Suggesting alternatives from a browser agent

The app doesn't call any AI service. Instead, an agent driving the browser can
use `window.minimalEditor` on the page:

```js
minimalEditor.help()      // these instructions, for an agent that just found the hook
minimalEditor.text()      // open doc as plain text: copy `find` strings from here
minimalEditor.read()      // open doc as Markdown
minimalEditor.docs()      // [{ id, title, open }]
await minimalEditor.open(id)  // switch to a doc (resolves once it's loaded)
minimalEditor.list()      // [{ id, shown, versions: [original, ...], fromAi }]

minimalEditor.suggest([
  { find: "quick brown", alternatives: ["speedy russet", "**fast** red"] },
  { find: "This sentence isn't needed. ", alternatives: [""] },  // removal, shown dimmed
  { find: "very good", alternatives: ["great"], show: "original", occurrence: 2 },
])
// → [{ ok: true, id, matches }, { ok: false, error, matches }, ...]

minimalEditor.insert({ markdown: "A new paragraph.", after: "End of the paragraph before." })
// → { ok: true } — new paragraphs after (or `before`) the one containing that text, or at the end
```

- `find` is exact plain text within one paragraph. Include the trailing space
  when removing a whole sentence, so the next one doesn't run into it.
- `alternatives` accept inline Markdown (bold, italic, links, code).
- The first suggestion is shown by default; `show: "original"` keeps the
  original on screen.
- `occurrence` picks which match (1 = first) when the text appears more than
  once; `matches` in the result says how many there are.
- Suggesting on text that is exactly an existing alternative adds versions to
  it.

Docs live in the browser's localStorage per address, so the agent only sees
docs written in the same browser profile at the same address (for example
`localhost:3000` and the deployed site keep separate docs).

## Storage

Each doc is stored in `localStorage` under its own key, so typing only rewrites
the doc you're in. The app asks the browser to keep this storage persistent.
Several open browser tabs stay in sync.

## Development

```bash
npm run dev
npm run lint
npm run build    # static export to ./out
```

## Deploy

The app is a static export served by Cloudflare Workers static assets at
`editor.beckyschmidt.me` (see `wrangler.jsonc`).

```bash
npm run preview  # build and serve locally with wrangler
npm run deploy   # build and deploy to Cloudflare
```

## Tech

- Next.js 16 (static export)
- React 19
- Tiptap 3
- Zustand
- Tailwind CSS 4
- Cloudflare Workers
