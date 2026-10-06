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

## Shortcuts

- `/` opens the block menu
- `# `, `## `, `### ` create headings
- `Cmd/Ctrl + K` adds a link
- `Cmd/Ctrl + Shift + C` copies the doc as Markdown
- `Alt + N` new doc
- `Alt + W` close doc (an Undo toast appears for a few seconds)
- `Alt + [` / `Alt + ]` previous / next doc
- `Alt + 1–9` jump to a doc (`9` is the last one)

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
