import type { Editor } from "@tiptap/core";
import { DOMSerializer } from "@tiptap/pm/model";
import { htmlToMarkdown } from "./markdown";

export async function copyEditorContentAsMarkdown(editor: Editor) {
  await navigator.clipboard.writeText(htmlToMarkdown(editor.getHTML()));
}

export function getEditorSelectionAsMarkdown(editor: Editor) {
  const { selection, schema } = editor.state;

  if (selection.empty) {
    return "";
  }

  const serializer = DOMSerializer.fromSchema(schema);
  const wrapper = document.createElement("div");
  const fragment = serializer.serializeFragment(selection.content().content, {
    document,
  });

  wrapper.appendChild(fragment);

  return htmlToMarkdown(wrapper.innerHTML).trim();
}

export async function copyEditorSelectionAsMarkdown(editor: Editor) {
  const markdown = getEditorSelectionAsMarkdown(editor);

  if (!markdown) {
    return false;
  }

  await navigator.clipboard.writeText(markdown);
  return true;
}
