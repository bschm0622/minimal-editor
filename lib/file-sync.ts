import { useEditorStore } from "./editor-store";

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface SaveFilePickerOptionsLike {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
}

type ShowSaveFilePicker = (
  options?: SaveFilePickerOptionsLike
) => Promise<FileSystemFileHandle>;

interface FilePickerWindow {
  showSaveFilePicker?: ShowSaveFilePicker;
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
    return true;
  } catch {
    return false;
  }
}
