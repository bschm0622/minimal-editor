# Minimal Editor

A deliberately simple writing app. Try it at
[editor.beckyschmidt.me](https://editor.beckyschmidt.me).

Docs live in your browser. There are no accounts, no server and no files to
open or save: every doc autosaves locally as you type, and you can keep
several docs open as tabs.

Any word, sentence or paragraph can hold several versions you switch between
in place and keep one of. An AI agent can add versions too, but the app has no
AI built in: your own agent drives the page in your own browser (see
[Working with an AI agent](#working-with-an-ai-agent)).

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

`Alt` is `Option` on a Mac.

- `/` opens the block menu
- `# `, `## `, `### ` create headings
- `Cmd/Ctrl + K` adds a link
- `Cmd/Ctrl + Shift + C` copies the doc as Markdown
- `Alt + N` new doc
- `Alt + W` close doc (an Undo toast appears for a few seconds)
- `Alt + [` / `Alt + ]` previous / next doc
- `Alt + 1–9` jump to a doc (`9` is the last one)
- `Alt + ↑` / `Alt + ↓` switch between alternatives (cursor in the text)
- `Alt + Enter` add an alternative to the selected text, or show or hide the versions (all alternatives when the cursor isn't in one)
- `Alt + D` dim or undim the selected text

## Alternatives

Text with a dotted underline has other versions: grey while the original is on
screen, blue while another version is. The small number after it says how
many versions there are. Put the cursor in it and press `Alt + ↑ / ↓` to
switch versions in place. A paragraph an agent adds arrives the same way, with
"not there" as its original: keep it, or keep "not there" and it goes.

`Alt + Enter` opens a side panel with the versions as a list (top line is the
original, a robot marks AI suggestions, a cut is crossed out). Type straight
into a line to rewrite it; `Enter` adds a version, `↑ / ↓` moves between them,
`Backspace` on an empty line deletes it, and `Esc` or `Alt + Enter` goes back
to the text. To settle on one, click the ✓ on its line or press
`Cmd/Ctrl + Enter`.

With the cursor outside any alternative, the panel lists them all, blue where
a suggestion is showing. Accept all keeps the doc exactly as it reads.

To add one yourself, select text and press `Alt + Enter` (or the layers button
in the bubble), then type the new version. `Alt + D` (or the eye button) dims the selected
text; click dimmed text and press it again, or use the Undim button, to bring
it back. Dimmed text is a version that
removes it: it stays faintly visible but isn't part of the doc (word count,
copy, Markdown).

Alternatives sit inside one paragraph and are saved with the doc. Copying text
copies what's on screen; copying or moving a whole alternative keeps its
versions.

## Working with an AI agent

The app doesn't call any AI service. Instead, your own agent connects to the
editor while you let it: it reads your doc and adds its suggestions as
alternatives, which you review like any others.

### Setup with Claude Code

1. Get the helper from this repo and add it to Claude Code (once). It needs
   Node 18 or newer:

   ```bash
   git clone https://github.com/bschm0622/minimal-editor
   cd minimal-editor/mcp && npm install
   claude mcp add --scope user minimal-editor -- node "$(pwd)/index.js"
   ```

   You don't need to run the editor itself: the hosted one at
   [editor.beckyschmidt.me](https://editor.beckyschmidt.me) connects to the
   helper on your computer.

2. Open the editor and click the robot button in the toolbar ("Connect
   agent"). The first time, Chrome asks to let the site reach apps on your
   device; allow it.
3. In Claude Code, type `/mcp__minimal-editor__edit`, optionally followed by
   what you want ("tighten the intro"). Or just ask in your own words, naming
   the editor: "suggest edits to my draft in Minimal Editor".

The connection only reaches the editor, and only while it's on. The helper
([`mcp/`](mcp)) runs on your computer, accepts connections only from the
editor's own address, and passes each request to the editor tab, which does
the work. Your docs never go anywhere except to your agent. Click the robot
button again or close the tab to end it.

It works in desktop Chrome, Edge and Firefox. Safari doesn't let a website
connect to an app on your computer. If you host your own copy, add its address
with `MINIMAL_EDITOR_ORIGINS` (see [`mcp/README.md`](mcp/README.md)).

### The API

The page also exposes the same API as `window.minimalEditor`, for agents that
already drive a browser:

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
// → { ok: true, ids }: after (or `before`) the paragraph containing that text, or at the end.
// New paragraphs and headings arrive as suggestions; lists, quotes, tables and code as plain text.
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

Your docs exist only in that browser. Clearing site data, or using a private
window, deletes them. Help → Download backup saves every doc, versions and
all, as one file; Restore backup adds them back as new tabs. If the browser's
storage fills up, the editor says so instead of silently not saving.

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build    # static export to ./out
```

The agent helper is its own small package in `mcp/`. To try a local copy with
Claude Code:

```bash
cd mcp && npm install
claude mcp add minimal-editor -- node "$PWD/index.js"
```

## Deploy

The app is a static export (`./out`), so any static host works. The live copy
is served by Cloudflare Workers static assets; to deploy your own, change the
route in `wrangler.jsonc` to your domain.

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

## Inspiration

- Jason Fried's [Write_On demo](https://x.com/jasonfried/status/2105403067793584590), for alternatives: switching between versions of
  a sentence in place, with a quiet list of them alongside.
- [Proof](https://proofeditor.ai) by Every (open source as
  [Proof SDK](https://github.com/EveryInc/proof-sdk)), for giving an agent a
  narrow way into the editor instead of the whole browser.

## License

[MIT](LICENSE)
