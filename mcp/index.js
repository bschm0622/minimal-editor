#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebSocketServer } from "ws";
import { z } from "zod";

/*
 * Lets an agent work in Minimal Editor without reaching anything else in the
 * browser. The editor tab connects to this process on 127.0.0.1 when the
 * writer clicks "Connect agent"; each tool call is passed to that tab and runs
 * there. Nothing is stored here.
 */

const PORT = Number(process.env.MINIMAL_EDITOR_PORT) || 47615;
const ORIGINS = [
  "https://editor.beckyschmidt.me",
  ...(process.env.MINIMAL_EDITOR_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const CALL_TIMEOUT_MS = 20_000;

let page = null;
let listening = false;
let nextId = 1;
const pending = new Map();

function log(...args) {
  // stdout carries the MCP protocol, so anything else goes to stderr.
  console.error("[minimal-editor-mcp]", ...args);
}

function listen() {
  const server = new WebSocketServer({
    host: "127.0.0.1",
    port: PORT,
    // Browsers always send Origin, and pages can't fake it: only the editor gets in.
    verifyClient: ({ origin }) => ORIGINS.includes(origin) || LOCAL_ORIGIN.test(origin),
  });

  server.on("listening", () => {
    listening = true;
    log(`waiting for the editor on 127.0.0.1:${PORT}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      // Another session has the editor. Take over once it exits.
      setTimeout(listen, 3000);
    } else {
      log(error.message);
    }
  });

  server.on("connection", (socket) => {
    // One editor tab at a time; the newest one wins.
    page?.close(4000, "Connected in another tab");
    page = socket;
    log("editor connected");

    socket.on("message", (data) => {
      let message;
      try {
        message = JSON.parse(String(data));
      } catch {
        return;
      }
      const call = pending.get(message.id);
      if (!call) return;
      pending.delete(message.id);
      clearTimeout(call.timer);
      if (message.error) call.reject(new Error(message.error));
      else call.resolve(message.result);
    });

    socket.on("close", () => {
      if (page !== socket) return;
      page = null;
      log("editor disconnected");
      for (const [id, call] of pending) {
        pending.delete(id);
        clearTimeout(call.timer);
        call.reject(new Error("The editor disconnected."));
      }
    });
  });
}

function callEditor(method, params = {}) {
  if (!page) {
    return Promise.reject(
      new Error(
        listening
          ? 'Minimal Editor isn\'t connected. Ask the writer to open the editor and click "Connect agent" in the toolbar.'
          : "Another agent session is connected to Minimal Editor. Close it, or ask the writer which session to use."
      )
    );
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("The editor didn't answer in time."));
    }, CALL_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    page.send(JSON.stringify({ id, method, params }));
  });
}

function tool(method, toParams = (args) => args) {
  return async (args) => {
    try {
      const result = await callEditor(method, toParams(args ?? {}));
      const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
      return { content: [{ type: "text", text }] };
    } catch (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
  };
}

const INSTRUCTIONS = `Use these tools whenever the user mentions their editor, their draft, a doc or post they're writing, or Minimal Editor, and asks you to read it, give feedback, suggest edits, cut, tighten or draft. Minimal Editor is a writing app whose docs live in the writer's browser. These tools reach the editor tab they connected from, and nothing else.

Suggest edits as alternatives: extra versions of a word, sentence or paragraph that the writer switches between in place and keeps one of. Never keep or reject versions for them, and only change their text through suggest, or insert when they asked for drafted text.

- read_doc (format "text") first. Copy find strings from it exactly; they must sit inside one paragraph.
- Send every suggestion in one suggest call and check each result. Fix the find text and resend failures.
- "" as a version suggests cutting the text; it shows dimmed in place. Include a sentence's trailing space when cutting it.
- Suggest at the smallest unit that works, and keep the writer's voice.
- Switching docs with open_doc changes what's on their screen, so say so.
- Inserted paragraphs aren't marked, so tell the writer which ones you added.

How they review: a dotted underline marks text with versions (blue when a suggestion is showing). Alt+↑/↓ (Option on a Mac) switches versions in place, Alt+Enter lists them, and the check on a version (or Cmd/Ctrl+Enter) accepts it.`;

const mcp = new McpServer(
  { name: "minimal-editor", version: "0.1.0" },
  { instructions: INSTRUCTIONS }
);

mcp.registerTool(
  "list_docs",
  {
    description:
      "Start here when the user asks about their draft or editor. The writer's docs in Minimal Editor: [{ id, title, open }]. The open one is on their screen.",
  },
  tool("docs")
);

mcp.registerTool(
  "open_doc",
  {
    description: "Switch the editor to another doc. This changes what's on the writer's screen.",
    inputSchema: { id: z.string().describe("A doc id from list_docs") },
  },
  tool("open", ({ id }) => ({ id }))
);

mcp.registerTool(
  "read_doc",
  {
    description:
      'The open doc. "text" (default) is plain text, one paragraph per block: copy find strings from it. Line breaks and dimmed text show as "￼". "markdown" shows headings and formatting.',
    inputSchema: { format: z.enum(["text", "markdown"]).optional() },
  },
  tool("read", ({ format }) => ({ format: format ?? "text" }))
);

mcp.registerTool(
  "list_alternatives",
  {
    description:
      "Alternatives already in the open doc: [{ id, shown, versions: [original, ...], fromAi }].",
  },
  tool("list")
);

mcp.registerTool(
  "suggest",
  {
    description:
      "Add versions to stretches of the open doc. Returns one result per suggestion: { ok, id } or { ok: false, error, matches }.",
    inputSchema: {
      suggestions: z
        .array(
          z.object({
            find: z.string().describe("Exact plain text inside one paragraph, copied from read_doc"),
            alternatives: z
              .array(z.string())
              .min(1)
              .describe('New versions; inline Markdown is fine. "" suggests cutting the text.'),
            occurrence: z
              .number()
              .int()
              .min(1)
              .optional()
              .describe("Which match to use when the text appears more than once (1 = first)"),
            show: z
              .enum(["first", "original"])
              .optional()
              .describe('"first" (default) shows the first suggestion; "original" keeps their text on screen'),
          })
        )
        .min(1),
    },
  },
  tool("suggest", ({ suggestions }) => ({ suggestions }))
);

mcp.registerTool(
  "insert",
  {
    description:
      "Add new paragraphs (Markdown) after or before the paragraph containing the given text, or at the end. Only when the writer asked for drafted text; to rewrite a paragraph, use suggest instead.",
    inputSchema: {
      markdown: z.string().min(1),
      after: z.string().optional().describe("Exact text from the paragraph before"),
      before: z.string().optional().describe("Exact text from the paragraph after"),
    },
  },
  tool("insert")
);

mcp.registerPrompt(
  "edit",
  {
    title: "Edit my draft",
    description: "Read the doc open in Minimal Editor and suggest edits as alternatives.",
    argsSchema: {
      request: z
        .string()
        .optional()
        .describe('What to do, e.g. "tighten the intro" or "draft a closing paragraph"'),
    },
  },
  ({ request }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Open my draft in Minimal Editor with the minimal-editor tools (list_docs, then read_doc) and ${
            request?.trim()
              ? `do this: ${request.trim()}`
              : "suggest edits where the writing could be clearer or tighter"
          }. Put rewrites in as alternatives with suggest so I can compare and keep my own; only insert new paragraphs if I asked for drafted text. Tell me briefly what you suggested.`,
        },
      },
    ],
  })
);

listen();
await mcp.connect(new StdioServerTransport());
