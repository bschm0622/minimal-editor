# minimal-editor-mcp

Lets an AI agent read your [Minimal Editor](https://editor.beckyschmidt.me)
docs and suggest edits, without giving it access to anything else in your
browser.

It's an [MCP](https://modelcontextprotocol.io) server that your agent starts.
When you click "Connect agent" in the editor, the editor tab connects to it on
`127.0.0.1`. Each tool call is passed to that tab, which does the work and
answers. The helper stores nothing, and only accepts connections from the
editor's own address.

## Setup with Claude Code

```bash
claude mcp add --scope user minimal-editor -- npx -y minimal-editor-mcp
```

Then open the editor, click the robot button in the toolbar, and in Claude
Code type `/mcp__minimal-editor__edit` (optionally followed by what you want,
like "tighten the intro"). Asking in your own words works too, as long as you
name the editor: "suggest edits to my draft in Minimal Editor".

## Tools

- `list_docs`: your docs, and which one is open
- `open_doc`: switch to another doc
- `read_doc`: the open doc as plain text or Markdown
- `list_alternatives`: versions already in the doc
- `suggest`: add versions of words, sentences or paragraphs, which you switch
  between and keep or drop in the editor
- `insert`: add drafted paragraphs, when you ask for them

## Settings

- `MINIMAL_EDITOR_ORIGINS`: extra addresses allowed to connect, comma
  separated, for a self-hosted editor (for example
  `https://write.example.com`). The hosted editor and `localhost` are always
  allowed.
- `MINIMAL_EDITOR_PORT`: the local port (default `47615`). The editor connects
  to the default, so only change it if you also change the editor.

Only one agent session holds the connection at a time; a second one waits and
takes over when the first exits.

## License

MIT
