import { useEditorStore } from "./editor-store";

// File System Access API is not in all TS libs
const w = globalThis as any;

export async function openFile(): Promise<string | null> {
  try {
    const [handle] = await w.showOpenFilePicker({
      types: [
        {
          description: "Markdown files",
          accept: { "text/markdown": [".md"] },
        },
      ],
    });
    useEditorStore.getState().setFileHandle(handle);
    const file = await handle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

export async function saveFile(content: string): Promise<boolean> {
  const handle = useEditorStore.getState().fileHandle;
  if (!handle) return false;

  try {
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    useEditorStore.getState().markSaved();
    return true;
  } catch {
    return false;
  }
}

export async function saveFileAs(content: string): Promise<boolean> {
  try {
    const handle = await w.showSaveFilePicker({
      suggestedName: "untitled.md",
      types: [
        {
          description: "Markdown files",
          accept: { "text/markdown": [".md"] },
        },
      ],
    });
    useEditorStore.getState().setFileHandle(handle);
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    useEditorStore.getState().markSaved();
    return true;
  } catch {
    return false;
  }
}

let fileSaveTimeout: ReturnType<typeof setTimeout> | null = null;

export function debouncedFileSync(content: string) {
  const handle = useEditorStore.getState().fileHandle;
  if (!handle) return;

  if (fileSaveTimeout) clearTimeout(fileSaveTimeout);
  fileSaveTimeout = setTimeout(() => {
    saveFile(content);
  }, 1000);
}
