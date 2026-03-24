import { create } from "zustand";

const STORAGE_KEY = "minimal-editor-content";
const FOCUS_MODE_KEY = "minimal-editor-focus-mode";
const FONT_KEY = "minimal-editor-font";

export type EditorFont = "sans" | "serif" | "mono";

interface EditorState {
  content: string;
  isSaved: boolean;
  fileHandle: FileSystemFileHandle | null;
  focusMode: boolean;
  font: EditorFont;
  setContent: (content: string) => void;
  markSaved: () => void;
  setFileHandle: (handle: FileSystemFileHandle | null) => void;
  toggleFocusMode: () => void;
  setFont: (font: EditorFont) => void;
  hydrate: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  content: "",
  isSaved: true,
  fileHandle: null,
  focusMode: false,
  font: "sans" as EditorFont,

  setContent: (content: string) => {
    set({ content, isSaved: false });
  },

  markSaved: () => {
    set({ isSaved: true });
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
        set({ content: saved, isSaved: true });
      }
      const fm = localStorage.getItem(FOCUS_MODE_KEY);
      if (fm) {
        set({ focusMode: JSON.parse(fm) });
      }
      const font = localStorage.getItem(FONT_KEY) as EditorFont | null;
      if (font && ["sans", "serif", "mono"].includes(font)) {
        set({ font });
      }
    } catch {}
  },
}));

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export function debouncedSave(content: string) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, content);
      useEditorStore.getState().markSaved();
    } catch {}
  }, 500);
}
