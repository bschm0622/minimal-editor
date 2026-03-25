# Minimal Editor

A deliberately simple writing app built with Next.js, Tiptap, and Tailwind.

It is designed around one current draft:
- your draft autosaves locally in the browser
- you can open an existing Markdown file
- you can save the current draft back to a file when you want
- you can paste Markdown directly into the editor and it will render as rich text

## Features

- Clean rich-text writing surface with Markdown-friendly shortcuts
- Slash menu for common block types
- Heading shortcuts like `# `, `## `, and `### `
- Paste Markdown directly into the editor
- Copy current content as Markdown
- Open an existing `.md` file
- Save the current draft to a `.md` file
- Local draft autosave
- Compare Versions — paste another version of your draft and selectively apply changes
- Focus mode
- Font switching: Clean (Figtree), Warm (Bitter), Editorial (Source Serif 4), Code (Geist Mono)
- Light and dark mode

## Writing Shortcuts

- `/` opens the block menu
- `# ` creates a heading
- `Cmd/Ctrl + O` opens a Markdown file
- `Cmd/Ctrl + S` saves to file
- `Cmd/Ctrl + Shift + S` saves as a new file
- `Cmd/Ctrl + Shift + C` copies Markdown

## Save Behavior

The app has two save layers:

1. **Local autosave**
   Your draft autosaves in this browser.

2. **File save**
   The first time you save, you choose a `.md` file.
   After that, `Save` keeps writing to that file in the current tab.
   Use `Save as...` to switch files.
   Files only change when you explicitly save.

## Compare Versions

Compare your draft against another version and selectively apply changes:

1. Open Compare Versions from the toolbar
2. Paste the other version (e.g. an AI rewrite) into the text area
3. The app diffs the two versions block-by-block
4. Unchanged sections are shown dimmed for context
5. Changed sections are highlighted with colored accents:
   - Amber for revisions (text changed)
   - Green for additions (new text)
   - Red for removals (text deleted)
6. For single-block revisions, an inline word diff shows exactly what changed
7. Click "Apply" to accept a change, or "Edit before applying" to tweak the suggested text first
8. Click "Done" to return to the editor

## Fonts

The current defaults are:

- Clean: `Figtree`
- Warm: `Bitter`
- Editorial: `Source Serif 4`
- Code: `Geist Mono`

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
