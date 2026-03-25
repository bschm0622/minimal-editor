import { useEditorStore } from "./editor-store";

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface SaveFilePickerOptionsLike {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
}

interface OpenFilePickerOptionsLike {
  multiple?: boolean;
  types?: FilePickerAcceptType[];
}

type ShowSaveFilePicker = (
  options?: SaveFilePickerOptionsLike
) => Promise<FileSystemFileHandle>;

type ShowOpenFilePicker = (
  options?: OpenFilePickerOptionsLike
) => Promise<FileSystemFileHandle[]>;

interface FilePickerWindow {
  showSaveFilePicker?: ShowSaveFilePicker;
  showOpenFilePicker?: ShowOpenFilePicker;
}

const pickerWindow = globalThis as unknown as FilePickerWindow;
const encoder = new TextEncoder();

const markdownPickerTypes: FilePickerAcceptType[] = [
  {
    description: "Markdown files",
    accept: {
      "text/markdown": [".md", ".markdown"],
      "text/plain": [".md", ".markdown", ".txt"],
    },
  },
];

export async function openFile(): Promise<string | null> {
  if (typeof document === "undefined") return null;

  const picker = pickerWindow.showOpenFilePicker;
  if (picker) {
    try {
      const [handle] = await picker({
        multiple: false,
        types: markdownPickerTypes,
      });
      const file = await handle.getFile();
      useEditorStore.getState().setFileHandle(handle);
      return await file.text();
    } catch {
      return null;
    }
  }

  // Fallback for browsers without File System Access API
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,.txt,text/markdown,text/plain";
    input.style.display = "none";

    input.addEventListener(
      "change",
      async () => {
        const file = input.files?.[0];
        input.remove();

        if (!file) {
          resolve(null);
          return;
        }

        useEditorStore.getState().setFileHandle(null);
        resolve(await file.text());
      },
      { once: true }
    );

    document.body.appendChild(input);
    input.click();
  });
}

export async function saveFile(content: string): Promise<boolean> {
  const handle = useEditorStore.getState().fileHandle;
  if (!handle) return false;

  try {
    const writable = await handle.createWritable();
    await writable.truncate(0);
    await writable.write(encoder.encode(content));
    await writable.close();
    useEditorStore.getState().markSaved();
    useEditorStore.getState().markFileSaved();
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
      types: markdownPickerTypes,
    });
    useEditorStore.getState().setFileHandle(handle);
    const writable = await handle.createWritable();
    await writable.truncate(0);
    await writable.write(encoder.encode(content));
    await writable.close();
    useEditorStore.getState().markSaved();
    useEditorStore.getState().markFileSaved();
    return true;
  } catch {
    return false;
  }
}
