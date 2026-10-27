import { Extension, type Editor } from "@tiptap/core";
import { create } from "zustand";
import {
  addAlternative,
  alternativeAt,
  alternativeInSelection,
  canAddAlternative,
  cycleAlternative,
  findAlternative,
  inlineToText,
  listAlternatives,
  resolveAlternative,
  toggleDim,
  updateAlternative,
  withoutVersion,
} from "./alternatives";
import { onBeforeDocChange, useEditorStore } from "./editor-store";
import { IS_MAC } from "./utils";

interface PanelFocus {
  id: string;
  index: number;
  /** Where the cursor goes in the version's text, or select all of it. */
  caret?: "start" | "end" | "all";
}

interface AlternativesUIState {
  panelOpen: boolean;
  /** A version the panel should put the cursor in once it renders. */
  focus: PanelFocus | null;
  /** A version added from the panel, dropped if it's left empty or unchanged. */
  fresh: { id: string; index: number } | null;
  openPanel: (focus?: PanelFocus) => void;
  closePanel: () => void;
  setFocus: (focus: PanelFocus | null) => void;
  setFresh: (fresh: AlternativesUIState["fresh"]) => void;
}

export const useAlternativesUI = create<AlternativesUIState>((set) => ({
  panelOpen: false,
  focus: null,
  fresh: null,
  openPanel: (focus) => set({ panelOpen: true, focus: focus ?? null }),
  closePanel: () => {
    pruneFreshVersion();
    set({ panelOpen: false, focus: null });
  },
  setFocus: (focus) => set({ focus }),
  setFresh: (fresh) => set({ fresh }),
}));

/** Drops the version just added in the panel if it was left empty or the same as the original. */
export function pruneFreshVersion(): { id: string; index: number } | null {
  const { fresh } = useAlternativesUI.getState();
  const { editor } = useEditorStore.getState();
  if (!fresh) return null;
  useAlternativesUI.setState({ fresh: null });
  if (!editor || editor.isDestroyed) return null;
  const range = listAlternatives(editor.state).find((r) => r.id === fresh.id);
  const content = range?.variants[fresh.index];
  if (content && (!content.length || inlineToText(content) === inlineToText(range.variants[0]))) {
    updateAlternative(editor, fresh.id, (attrs) => withoutVersion(attrs, fresh.index));
    return fresh;
  }
  return null;
}

// Tidy up before another doc opens, while edits still save to this one.
onBeforeDocChange(() => useAlternativesUI.getState().closePanel());

/** Makes the selection an alternative and opens a blank line in the panel for the new version. */
export function startAlternativeFromSelection(editor: Editor) {
  const { from, to } = editor.state.selection;
  // The blank version stays out of sight until it has text, and is dropped if it never does.
  const result = addAlternative(editor, { from, to }, [[]], { show: "original", select: true });
  if (result.ok) {
    const ui = useAlternativesUI.getState();
    ui.setFresh({ id: result.id, index: 1 });
    ui.openPanel({ id: result.id, index: 1 });
  }
  return result;
}

/** Opens the panel on an alternative, moving the cursor into it so the panel follows. */
export function showVersions(editor: Editor, id: string) {
  const range = findAlternative(editor.state.doc, id);
  if (!range) return false;
  editor.commands.setTextSelection(range.to);
  useAlternativesUI.getState().openPanel({ id, index: range.active });
  return true;
}

export const AlternativeShortcuts = Extension.create({
  name: "alternativeShortcuts",
  // Ahead of the editor's own keymap, which deletes on Option+D on a Mac.
  priority: 1001,

  addKeyboardShortcuts() {
    return {
      "Alt-ArrowUp": () => cycleAlternative(this.editor, -1),
      "Alt-ArrowDown": () => cycleAlternative(this.editor, 1),
      // In text with versions, accept the one showing; elsewhere it's still a line break.
      "Mod-Enter": () => {
        const range = alternativeAt(this.editor.state);
        if (!range) return false;
        pruneFreshVersion();
        useAlternativesUI.getState().closePanel();
        return resolveAlternative(this.editor, range.id, "shown");
      },
      "Alt-Enter": () => {
        const ui = useAlternativesUI.getState();
        if (ui.panelOpen) {
          ui.closePanel();
          return true;
        }
        const { state } = this.editor;
        const { from, to, empty } = state.selection;
        if (!empty && canAddAlternative(state, from, to)) {
          return startAlternativeFromSelection(this.editor).ok;
        }
        const id = alternativeInSelection(state);
        if (id) return showVersions(this.editor, id);
        ui.openPanel();
        return true;
      },
      // Elsewhere Alt+D passes through when there's nothing to dim (it's the
      // browser's address bar shortcut); on a Mac it would delete text.
      "Alt-d": () => toggleDim(this.editor) || IS_MAC,
      Escape: () => {
        if (!useAlternativesUI.getState().panelOpen) return false;
        useAlternativesUI.getState().closePanel();
        return true;
      },
    };
  },
});
