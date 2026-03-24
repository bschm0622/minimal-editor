import type { Editor } from "@tiptap/core";
import { flushSavedContent, useEditorStore } from "./editor-store";
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

  const html = markdownToHtml(nextContent);
  const { editor, loadContent } = useEditorStore.getState();

  loadContent(html);

  if (editor && editor.getHTML() !== html) {
    editor.commands.setContent(html, { emitUpdate: false });
  }

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

function getCurrentHtml() {
  const { editor, content } = useEditorStore.getState();
  return editor ? editor.getHTML() : content;
}

function getCurrentMarkdown() {
  return htmlToMarkdown(getCurrentHtml());
}

export async function saveCurrentDraftToFile() {
  const { setContent } = useEditorStore.getState();
  const html = getCurrentHtml();

  setContent(html);
  flushSavedContent(html);

  return saveMarkdownToFile(htmlToMarkdown(html));
}

export async function saveCurrentDraftToNewFile() {
  const { setContent, setFileHandle } = useEditorStore.getState();
  const html = getCurrentHtml();

  setContent(html);
  flushSavedContent(html);
  setFileHandle(null);

  const didSave = await saveFileAs(htmlToMarkdown(html));

  if (didSave) {
    notifyManualFileSave();
  }

  return didSave;
}

export async function saveEditorContentToFile(editor: Editor) {
  return saveMarkdownToFile(htmlToMarkdown(editor.getHTML()));
}

export async function copyCurrentDraftAsMarkdown() {
  await navigator.clipboard.writeText(getCurrentMarkdown());
}

export async function copyEditorContentAsMarkdown(editor: Editor) {
  await navigator.clipboard.writeText(htmlToMarkdown(editor.getHTML()));
}
