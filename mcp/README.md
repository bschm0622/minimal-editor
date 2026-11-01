# Minimal Editor helper

Lets an AI agent read your [Minimal Editor](https://editor.beckyschmidt.me)
docs and suggest edits, without giving it access to anything else in your
browser.

It's an [MCP](https://modelcontextprotocol.io) server that your agent starts.
When you click "Connect agent" in the editor, the editor tab connects to it on
`127.0.0.1`. Each tool call is passed to that tab, which does the work and
answers. The helper stores nothing, and only accepts connections from the
editor's own address.

## Setup with Claude Code

From a copy of this repo, with Node 18 or newer:

```bash
cd mcp && npm install
claude mcp add --scope user minimal-editor -- node "$(pwd)/index.js"
```

Then open the editor, click the agent button in the toolbar (a pencil with a sparkle), and in Claude
Code type `/mcp__minimal-editor__edit` (optionally followed by what you want,
like "tighten the intro"). Asking in your own words works too, as long as you
name the editor: "suggest edits to my draft in Minimal Editor".

## Tools

- `list_docs`: your docs, and which one is open
- `open_doc`: show another doc on your screen
- `read_doc`: a doc as plain text or Markdown
- `list_alternatives`: versions already in a doc
- `suggest`: add versions of words, sentences or paragraphs, which you switch
  between and keep or drop in the editor
- `insert`: add drafted paragraphs when you ask for them, as suggestions you
  keep or drop
- `create_doc`: add a new doc as the last tab, when you ask for one

Every tool works on the doc on your screen unless the agent passes another
doc's id. It can read and edit a doc you don't have open, so you can keep
reading or writing elsewhere while it works; you'll see its changes when you
switch to that doc.

## Settings

- `MINIMAL_EDITOR_ORIGINS`: extra addresses allowed to connect, comma
  separated, for a self-hosted editor (for example
  `https://write.example.com`). The hosted editor and `localhost` are always
  allowed.
- `MINIMAL_EDITOR_PORT`: the local port (default `47615`). The editor connects
  to the default, so only change it if you also change the editor.

Only one agent session holds the connection at a time. Whichever session last
used an editor tool gets it: the session holding it steps aside, and the editor
tab reconnects to the new one in about a second.

## License

MIT
