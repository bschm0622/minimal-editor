import { create } from "zustand";
import type { Editor } from "@tiptap/core";

const STORAGE_KEY = "minimal-editor-content";
const FOCUS_MODE_KEY = "minimal-editor-focus-mode";
const FONT_KEY = "minimal-editor-font";

export type EditorFont = "sans" | "serif" | "mono";

interface EditorState {
  editor: Editor | null;
  content: string;
  isSaved: boolean;
  fileDirty: boolean;
  fileHandle: FileSystemFileHandle | null;
  focusMode: boolean;
  font: EditorFont;
  hydrated: boolean;
  lastManualSaveAt: number;
  setContent: (content: string) => void;
  loadContent: (content: string) => void;
  markSaved: () => void;
  markFileSaved: () => void;
  notifyManualSave: () => void;
  setEditor: (editor: Editor | null) => void;
  setFileHandle: (handle: FileSystemFileHandle | null) => void;
  toggleFocusMode: () => void;
  setFont: (font: EditorFont) => void;
  hydrate: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  editor: null,
  content: "",
  isSaved: true,
  fileDirty: false,
  fileHandle: null,
  focusMode: false,
  font: "sans" as EditorFont,
  hydrated: false,
  lastManualSaveAt: 0,

  setContent: (content: string) => {
    set({ content, isSaved: false, fileDirty: true });
  },

  loadContent: (content: string) => {
    set({ content, isSaved: true, fileDirty: false });
  },

  markSaved: () => {
    set({ isSaved: true });
  },

  markFileSaved: () => {
    set({ fileDirty: false });
  },

  notifyManualSave: () => {
    set({ lastManualSaveAt: Date.now() });
  },

  setEditor: (editor: Editor | null) => {
    set({ editor });
  },

  setFileHandle: (handle: FileSystemFileHandle | null) => {
    set({ fileHandle: handle });
  },

  setFont: (font: EditorFont) => {
    set({ font });
    try {
      localStorage.setItem(FONT_KEY, font);
    } catch {}
  },

  toggleFocusMode: () => {
    const next = !get().focusMode;
    set({ focusMode: next });
    try {
      localStorage.setItem(FOCUS_MODE_KEY, JSON.stringify(next));
    } catch {}
  },

  hydrate: () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        set({ content: saved, isSaved: true, fileDirty: false });
      }
      const fm = localStorage.getItem(FOCUS_MODE_KEY);
      if (fm) {
        set({ focusMode: JSON.parse(fm) });
      }
      const font = localStorage.getItem(FONT_KEY) as EditorFont | null;
      if (font && ["sans", "serif", "mono"].includes(font)) {
        set({ font });
      }
    } catch {
      // Ignore storage errors and continue with defaults.
    } finally {
      set({ hydrated: true });
    }
  },
}));

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export function debouncedSave(content: string) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    flushSavedContent(content);
  }, 500);
}

export function flushSavedContent(content: string) {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  try {
    localStorage.setItem(STORAGE_KEY, content);
    useEditorStore.getState().markSaved();
  } catch {}
}
