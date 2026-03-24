# Minimal Editor

A deliberately simple writing app built with Next.js, Tiptap, and Tailwind.

It is designed around one current draft:
- your draft autosaves locally in the browser
- you can open an existing Markdown file
- you can save the current draft back to a file when you want

## Features

- Clean rich-text writing surface with Markdown-friendly shortcuts
- Slash menu for common block types
- Heading shortcuts like `# `, `## `, and `### `
- Copy current content as Markdown
- Open and save `.md` files with the File System Access API
- Local draft autosave
- Focus mode
- Font switching: sans, serif, mono
- Light and dark mode

## Writing Shortcuts

- `/` opens the slash menu for blocks
- `# ` creates a heading
- `Cmd/Ctrl + O` opens a Markdown file
- `Cmd/Ctrl + S` saves to file
- `Cmd/Ctrl + Shift + C` copies Markdown

## Save Behavior

The app has two save layers:

1. Local autosave
   The current draft is automatically saved in browser storage.

2. File save
   When you use the save action, the draft is written to a `.md` file.
   After a file has been chosen once, future saves write back to that same file.

## Fonts

The current defaults are:

- Sans: `Figtree`
- Serif: `Lora`
- Mono: `Geist Mono`

## Development

Run the development server:

```bash
npm run dev
```

Then open `http://localhost:3000`.

Useful scripts:

```bash
npm run dev
npm run lint
npm run build
```

## Tech

- Next.js 16
- React 19
- Tiptap 3
- Zustand
- Tailwind CSS 4
