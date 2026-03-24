import type { Editor } from "@tiptap/core";
import { useEditorStore } from "./editor-store";
import { openFile, saveFile, saveFileAs } from "./file-sync";
import { htmlToMarkdown, markdownToHtml } from "./markdown";

export const MANUAL_FILE_SAVE_EVENT = "manual-file-save";

function notifyManualFileSave() {
  useEditorStore.getState().notifyManualSave();
  window.dispatchEvent(new Event(MANUAL_FILE_SAVE_EVENT));
}

export function confirmDiscardDraft() {
  if (useEditorStore.getState().isSaved) return true;

  return window.confirm(
    "Open a file and replace the current draft? Unsaved changes in the editor will be overwritten."
  );
}

export async function openMarkdownFileIntoStore() {
  if (!confirmDiscardDraft()) return false;

  const nextContent = await openFile();
  if (nextContent === null) return false;

  useEditorStore.getState().loadContent(markdownToHtml(nextContent));
  return true;
}

async function saveMarkdownToFile(markdown: string) {
  const fileHandle = useEditorStore.getState().fileHandle;
  const didSave = fileHandle
    ? await saveFile(markdown)
    : await saveFileAs(markdown);

  if (didSave) {
    notifyManualFileSave();
  }

  return didSave;
}

export async function saveStoreContentToFile() {
  const content = useEditorStore.getState().content;
  return saveMarkdownToFile(htmlToMarkdown(content));
}

export async function saveEditorContentToFile(editor: Editor) {
  return saveMarkdownToFile(htmlToMarkdown(editor.getHTML()));
}

export async function copyStoreContentAsMarkdown() {
  const content = useEditorStore.getState().content;
  await navigator.clipboard.writeText(htmlToMarkdown(content));
}

export async function copyEditorContentAsMarkdown(editor: Editor) {
  await navigator.clipboard.writeText(htmlToMarkdown(editor.getHTML()));
}
