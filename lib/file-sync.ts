import { useEditorStore } from "./editor-store";

type ShowOpenFilePicker = (
  options?: OpenFilePickerOptions
) => Promise<FileSystemFileHandle[]>;

type ShowSaveFilePicker = (
  options?: SaveFilePickerOptions
) => Promise<FileSystemFileHandle>;

interface FilePickerWindow extends Window {
  showOpenFilePicker?: ShowOpenFilePicker;
  showSaveFilePicker?: ShowSaveFilePicker;
}

const pickerWindow = globalThis as FilePickerWindow;

export async function openFile(): Promise<string | null> {
  try {
    const picker = pickerWindow.showOpenFilePicker;
    if (!picker) return null;

    const [handle] = await picker({
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
    const picker = pickerWindow.showSaveFilePicker;
    if (!picker) return false;

    const handle = await picker({
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
