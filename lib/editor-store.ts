import { create } from "zustand";
import type { Editor } from "@tiptap/core";
import type { EditorState as ProseMirrorState } from "@tiptap/pm/state";

const LEGACY_CONTENT_KEY = "minimal-editor-content";
const DOCS_KEY = "minimal-editor-docs";
const ACTIVE_DOC_KEY = "minimal-editor-active-doc";
const DOC_CONTENT_PREFIX = "minimal-editor-doc:";
const FOCUS_MODE_KEY = "minimal-editor-focus-mode";
const FONT_KEY = "minimal-editor-font";

const FONTS = ["sans", "classic", "mono", "editorial"] as const;
const SAVE_DELAY_MS = 400;
const UNDO_CLOSE_MS = 6000;

export type EditorFont = (typeof FONTS)[number];

export interface Doc {
  id: string;
  title: string;
  words: number;
  updatedAt: number;
}

interface ClosedDoc {
  doc: Doc;
  index: number;
  content: string;
}

interface EditorState {
  editor: Editor | null;
  docs: Doc[];
  activeId: string;
  lastClosed: ClosedDoc | null;
  /** Bumped when another browser tab rewrites the active doc. */
  externalRevision: number;
  focusMode: boolean;
  font: EditorFont;
  hydrated: boolean;
  setEditor: (editor: Editor | null) => void;
  newDoc: () => void;
  switchDoc: (id: string) => void;
  switchDocBy: (offset: number) => void;
  closeDoc: (id: string) => void;
  undoClose: () => void;
  dismissUndoClose: () => void;
  toggleFocusMode: () => void;
  setFont: (font: EditorFont) => void;
  hydrate: () => void;
}

function createId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function emptyDoc(): Doc {
  return { id: createId(), title: "", words: 0, updatedAt: Date.now() };
}

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function removeStorage(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function persistDocs(docs: Doc[]) {
  writeStorage(DOCS_KEY, JSON.stringify(docs));
}

export function readDocContent(id: string) {
  return readStorage(DOC_CONTENT_PREFIX + id) ?? "";
}

/** In-memory editor state per doc, so undo history and scroll survive tab switches. */
export const docSessions = new Map<
  string,
  { state: ProseMirrorState; scrollY: number }
>();

let undoCloseTimeout: ReturnType<typeof setTimeout> | null = null;

export const useEditorStore = create<EditorState>((set, get) => ({
  editor: null,
  docs: [],
  activeId: "",
  lastClosed: null,
  externalRevision: 0,
  focusMode: false,
  font: "sans",
  hydrated: false,

  setEditor: (editor) => set({ editor }),

  newDoc: () => {
    flushPendingSave();
    const doc = emptyDoc();
    const { docs, activeId } = get();
    const index = docs.findIndex((d) => d.id === activeId);
    const next = [...docs];
    next.splice(index + 1, 0, doc);
    persistDocs(next);
    writeStorage(ACTIVE_DOC_KEY, doc.id);
    set({ docs: next, activeId: doc.id });
  },

  switchDoc: (id) => {
    if (id === get().activeId || !get().docs.some((d) => d.id === id)) return;
    flushPendingSave();
    writeStorage(ACTIVE_DOC_KEY, id);
    set({ activeId: id });
  },

  switchDocBy: (offset) => {
    const { docs, activeId, switchDoc } = get();
    const index = docs.findIndex((d) => d.id === activeId);
    const next = docs[(index + offset + docs.length) % docs.length];
    if (next) switchDoc(next.id);
  },

  closeDoc: (id) => {
    flushPendingSave();
    const { docs, activeId } = get();
    const index = docs.findIndex((d) => d.id === id);
    if (index === -1) return;

    const doc = docs[index];
    const content = readDocContent(id);
    let next = docs.filter((d) => d.id !== id);
    let nextActive = activeId;

    if (next.length === 0) {
      const fresh = emptyDoc();
      next = [fresh];
      nextActive = fresh.id;
    } else if (id === activeId) {
      nextActive = next[Math.min(index, next.length - 1)].id;
    }

    removeStorage(DOC_CONTENT_PREFIX + id);
    docSessions.delete(id);
    persistDocs(next);
    writeStorage(ACTIVE_DOC_KEY, nextActive);

    // Closing an empty doc isn't worth an undo prompt.
    const lastClosed = doc.words > 0 ? { doc, index, content } : null;
    set({ docs: next, activeId: nextActive, lastClosed });

    if (undoCloseTimeout) clearTimeout(undoCloseTimeout);
    if (lastClosed) {
      undoCloseTimeout = setTimeout(() => set({ lastClosed: null }), UNDO_CLOSE_MS);
    }
  },

  undoClose: () => {
    const { lastClosed, docs } = get();
    if (!lastClosed) return;
    flushPendingSave();

    const { doc, index, content } = lastClosed;
    // Drop the placeholder doc created when the last tab was closed.
    const base =
      docs.length === 1 && docs[0].words === 0 && !readDocContent(docs[0].id)
        ? []
        : docs;
    const next = [...base];
    next.splice(Math.min(index, next.length), 0, doc);

    writeStorage(DOC_CONTENT_PREFIX + doc.id, content);
    persistDocs(next);
    writeStorage(ACTIVE_DOC_KEY, doc.id);
    set({ docs: next, activeId: doc.id, lastClosed: null });
  },

  dismissUndoClose: () => set({ lastClosed: null }),

  setFont: (font) => {
    set({ font });
    writeStorage(FONT_KEY, font);
  },

  toggleFocusMode: () => {
    const next = !get().focusMode;
    set({ focusMode: next });
    writeStorage(FOCUS_MODE_KEY, JSON.stringify(next));
  },

  hydrate: () => {
    let docs: Doc[] = [];
    try {
      const parsed = JSON.parse(readStorage(DOCS_KEY) ?? "[]");
      if (Array.isArray(parsed)) docs = parsed;
    } catch {}

    // Copy the single draft from the old one-document version. The original
    // key is left in place so nothing is lost if the old version comes back.
    const legacy = readStorage(LEGACY_CONTENT_KEY);
    if (docs.length === 0 && legacy?.trim()) {
      const doc = { ...emptyDoc(), ...describeHtml(legacy) };
      writeStorage(DOC_CONTENT_PREFIX + doc.id, legacy);
      docs = [doc];
    }

    if (docs.length === 0) docs = [emptyDoc()];
    persistDocs(docs);

    const storedActive = readStorage(ACTIVE_DOC_KEY);
    const activeId = docs.some((d) => d.id === storedActive)
      ? storedActive!
      : docs[0].id;

    const font = readStorage(FONT_KEY) as EditorFont | null;
    const focusMode = readStorage(FOCUS_MODE_KEY) === "true";

    set({
      docs,
      activeId,
      focusMode,
      font: font && FONTS.includes(font) ? font : "sans",
      hydrated: true,
    });

    // Docs only live in this browser, so ask it not to evict them.
    navigator.storage?.persist?.().catch(() => {});
    window.addEventListener("storage", handleOtherTabChange);
  },
}));

/** Keeps several open browser tabs from overwriting each other's docs. */
function handleOtherTabChange(event: StorageEvent) {
  if (!event.key) return;
  const { docs, activeId, externalRevision } = useEditorStore.getState();

  if (event.key === DOCS_KEY && event.newValue) {
    try {
      const next = JSON.parse(event.newValue) as Doc[];
      if (!Array.isArray(next) || next.length === 0) return;
      const stillOpen = next.some((d) => d.id === activeId);
      if (!stillOpen) pendingSave = null;
      for (const id of docSessions.keys()) {
        if (!next.some((d) => d.id === id)) docSessions.delete(id);
      }
      useEditorStore.setState({
        docs: next,
        activeId: stillOpen ? activeId : next[0].id,
      });
    } catch {}
    return;
  }

  if (event.key.startsWith(DOC_CONTENT_PREFIX)) {
    const id = event.key.slice(DOC_CONTENT_PREFIX.length);
    docSessions.delete(id);
    // Don't clobber edits this tab hasn't saved yet.
    if (id === activeId && pendingSave?.id !== id && docs.some((d) => d.id === id)) {
      useEditorStore.setState({ externalRevision: externalRevision + 1 });
    }
  }
}

function countWords(text: string) {
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
}

function describeHtml(html: string) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  const firstBlock = Array.from(wrapper.children).find((el) =>
    el.textContent?.trim()
  );
  return {
    title: firstBlock?.textContent?.trim().slice(0, 80) ?? "",
    words: countWords(wrapper.textContent ?? ""),
  };
}

function describeEditor(editor: Editor) {
  let title = "";
  editor.state.doc.forEach((node) => {
    if (!title) title = node.textContent.trim().slice(0, 80);
  });
  return {
    title,
    words: countWords(editor.state.doc.textBetween(0, editor.state.doc.content.size, " ", " ")),
  };
}

let pendingSave: { id: string; editor: Editor } | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Schedules a save of the active doc. Serializing to HTML is deferred until
 * the save actually runs, so typing doesn't pay for it on every keystroke.
 */
export function scheduleSave(editor: Editor) {
  pendingSave = { id: useEditorStore.getState().activeId, editor };
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(flushPendingSave, SAVE_DELAY_MS);
}

export function flushPendingSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  if (!pendingSave) return;

  const { id, editor } = pendingSave;
  pendingSave = null;
  if (editor.isDestroyed) return;

  const { docs } = useEditorStore.getState();
  if (!docs.some((d) => d.id === id)) return;

  writeStorage(DOC_CONTENT_PREFIX + id, editor.isEmpty ? "" : editor.getHTML());

  const { title, words } = describeEditor(editor);
  const next = docs.map((d) =>
    d.id === id ? { ...d, title, words, updatedAt: Date.now() } : d
  );
  persistDocs(next);
  useEditorStore.setState({ docs: next });
}

export function docLabel(doc: Doc) {
  return doc.title || "Untitled";
}
