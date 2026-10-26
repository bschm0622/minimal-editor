import { create } from "zustand";
import { announce } from "./announce";
import { editorApi } from "./editor-api";

/*
 * The editor's side of the agent connection. When the writer turns it on, the
 * page connects to the minimal-editor-mcp helper on this computer and runs the
 * calls it passes along. Turning it off closes the connection.
 */

const PORT = 47615;
const SESSION_KEY = "minimal-editor-agent";
/** Sent by the helper when another tab connects and takes over. */
const REPLACED_CODE = 4000;

type Status = "off" | "waiting" | "connected";

export const useAgentBridge = create<{ status: Status }>(() => ({ status: "off" }));

type Params = Record<string, unknown>;

const methods: Record<string, (params: Params) => unknown> = {
  docs: () => editorApi.docs(),
  open: ({ id }) => editorApi.open(String(id)),
  read: ({ format }) => (format === "markdown" ? editorApi.read() : editorApi.text()),
  list: () => editorApi.list(),
  suggest: ({ suggestions }) => editorApi.suggest(suggestions as Parameters<typeof editorApi.suggest>[0]),
  insert: (params) => editorApi.insert(params as unknown as Parameters<typeof editorApi.insert>[0]),
};

let socket: WebSocket | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 1000;

function setStatus(status: Status) {
  if (useAgentBridge.getState().status === status) return;
  useAgentBridge.setState({ status });
  if (status === "connected") announce("Agent connected");
  if (status === "off") announce("Agent disconnected");
}

function connect() {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  socket = ws;

  ws.onopen = () => {
    retryDelay = 1000;
    setStatus("connected");
  };

  ws.onmessage = async (event) => {
    let call: { id?: number; method?: string; params?: Params };
    try {
      call = JSON.parse(String(event.data));
    } catch {
      return;
    }
    const { id, method = "", params = {} } = call;
    try {
      const handler = methods[method];
      if (!handler) throw new Error(`Unknown request: ${method}`);
      ws.send(JSON.stringify({ id, result: (await handler(params)) ?? null }));
    } catch (error) {
      ws.send(JSON.stringify({ id, error: error instanceof Error ? error.message : String(error) }));
    }
  };

  ws.onclose = (event) => {
    if (socket !== ws) return;
    socket = null;
    if (event.code === REPLACED_CODE) {
      stopAgentBridge();
      return;
    }
    if (useAgentBridge.getState().status === "off") return;
    // No helper running yet: keep trying quietly, backing off to every 10 seconds.
    setStatus("waiting");
    retry = setTimeout(connect, retryDelay);
    retryDelay = Math.min(retryDelay * 2, 10_000);
  };
}

export function startAgentBridge() {
  if (useAgentBridge.getState().status !== "off") return;
  sessionStorage.setItem(SESSION_KEY, "on");
  setStatus("waiting");
  retryDelay = 1000;
  connect();
}

export function stopAgentBridge() {
  sessionStorage.removeItem(SESSION_KEY);
  if (retry) clearTimeout(retry);
  retry = null;
  setStatus("off");
  const ws = socket;
  socket = null;
  ws?.close();
}

/** Reconnects after a reload if the writer left it on in this tab. */
export function resumeAgentBridge() {
  if (sessionStorage.getItem(SESSION_KEY) === "on") startAgentBridge();
}
